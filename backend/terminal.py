"""
Nexus Computer — PTY WebSocket terminal.

Spawns a bash shell inside the workspace and bridges it to the browser
via a WebSocket. Supports ANSI/xterm-256color, window resize, and
full interactive programs (vim, htop, etc).
"""

import asyncio
import fcntl
import json
import os
import pty
import struct
import subprocess
import termios

from fastapi import WebSocket, WebSocketDisconnect


async def terminal_ws(websocket: WebSocket, workspace: str, username: str = "nexus"):
    """Handle a single terminal WebSocket session."""
    await websocket.accept()

    # Open PTY pair
    master_fd, slave_fd = pty.openpty()

    env = os.environ.copy()
    env.update({
        "TERM": "xterm-256color",
        "COLORTERM": "truecolor",
        "HOME": workspace,
        "PWD": workspace,
        "USER": username,
        "SHELL": "/bin/bash",
        "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "PS1": r"\[\033[0;36m\]nexus\[\033[0m\]:\[\033[0;32m\]\w\[\033[0m\]$ ",
    })

    proc = subprocess.Popen(
        ["/bin/bash", "--login"],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        cwd=workspace,
        env=env,
        close_fds=True,
    )
    os.close(slave_fd)

    loop = asyncio.get_event_loop()
    stop = asyncio.Event()

    async def pty_to_ws():
        """Forward PTY output → WebSocket."""
        while not stop.is_set():
            try:
                data = await loop.run_in_executor(None, lambda: os.read(master_fd, 4096))
                if not data:
                    break
                await websocket.send_bytes(data)
            except (OSError, WebSocketDisconnect, RuntimeError):
                break
        stop.set()

    async def ws_to_pty():
        """Forward WebSocket input → PTY."""
        while not stop.is_set():
            try:
                msg = await asyncio.wait_for(websocket.receive(), timeout=30.0)
                if "bytes" in msg:
                    os.write(master_fd, msg["bytes"])
                elif "text" in msg:
                    try:
                        j = json.loads(msg["text"])
                        if j.get("type") == "resize":
                            rows = max(1, int(j.get("rows", 24)))
                            cols = max(1, int(j.get("cols", 80)))
                            fcntl.ioctl(
                                master_fd,
                                termios.TIOCSWINSZ,
                                struct.pack("HHHH", rows, cols, 0, 0),
                            )
                        elif j.get("type") == "ping":
                            await websocket.send_text(json.dumps({"type": "pong"}))
                    except (json.JSONDecodeError, KeyError, ValueError):
                        os.write(master_fd, msg["text"].encode())
            except asyncio.TimeoutError:
                # keepalive — ping the client
                try:
                    await websocket.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    break
            except (WebSocketDisconnect, RuntimeError):
                break
            except OSError:
                break
        stop.set()

    try:
        await asyncio.gather(pty_to_ws(), ws_to_pty())
    finally:
        stop.set()
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
        try:
            os.close(master_fd)
        except OSError:
            pass
