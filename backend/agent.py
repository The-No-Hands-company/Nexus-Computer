import anthropic
import httpx
import json
import os
import subprocess
from typing import AsyncGenerator

# ── AI engine selection ────────────────────────────────────────────────────────
# By default Nexus Computer uses the Anthropic SDK directly.
# Set NEXUS_AI_URL (e.g. http://localhost:7866) to route through Nexus AI — the
# sovereign NS AI engine — instead. ANTHROPIC_API_KEY takes priority if present.

_NEXUS_AI_URL = os.environ.get("NEXUS_AI_URL", "").rstrip("/")
_ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")

if _ANTHROPIC_KEY:
    client = anthropic.Anthropic(api_key=_ANTHROPIC_KEY)
else:
    client = None  # will use Nexus AI path

MODEL = os.environ.get("NEXUS_MODEL", "claude-sonnet-4-6")

SYSTEM_PROMPT = """You are Nexus, a privacy-first personal cloud computer for The No Hands Company.

Core values:
- Free as in freedom and free as in price
- No paywalls, subscriptions, ads, tracking, or dark patterns
- Privacy first by default
- Build polished, durable, production-grade software
- Prefer clear, honest, concise communication

Operating rules:
- You have full access to the user's workspace.
- Use the available tools to inspect, modify, and run code.
- Before making risky or destructive changes, explain the plan briefly.
- Favor small, reliable steps over large speculative ones.
- If a task can be verified, verify it.
- Keep responses direct and practical.

You are helping build a production-ready personal cloud computer that feels calm, powerful, and trustworthy."""

TOOLS = [
    {
        "name": "bash",
        "description": "Execute a bash command in the workspace. Use for running scripts, installing packages, creating/moving files, managing processes, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Bash command to execute",
                }
            },
            "required": ["command"],
        },
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file in the workspace",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path relative to workspace",
                }
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write content to a file, creating directories as needed",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path relative to workspace"},
                "content": {"type": "string", "description": "Content to write"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "list_files",
        "description": "List files and directories at a path in the workspace",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory path relative to workspace (empty for root)",
                    "default": "",
                }
            },
        },
    },
]


def _execute_tool(name: str, inp: dict, workspace: str) -> str:
    if name == "bash":
        try:
            result = subprocess.run(
                inp["command"],
                shell=True,
                capture_output=True,
                text=True,
                timeout=60,
                cwd=workspace,
            )
            out = result.stdout
            if result.stderr:
                out += f"\n[stderr] {result.stderr}"
            if result.returncode != 0:
                out += f"\n[exit {result.returncode}]"
            return out.strip() or "(no output)"
        except subprocess.TimeoutExpired:
            return "[timeout] Command exceeded 60 seconds"
        except Exception as e:
            return f"[error] {e}"

    elif name == "read_file":
        try:
            p = os.path.join(workspace, inp["path"].lstrip("/"))
            with open(p) as f:
                return f.read()
        except Exception as e:
            return f"[error] {e}"

    elif name == "write_file":
        try:
            p = os.path.join(workspace, inp["path"].lstrip("/"))
            os.makedirs(os.path.dirname(p) or workspace, exist_ok=True)
            with open(p, "w") as f:
                f.write(inp["content"])
            return f"Written: {inp['path']}"
        except Exception as e:
            return f"[error] {e}"

    elif name == "list_files":
        try:
            p = os.path.join(workspace, inp.get("path", "").lstrip("/"))
            items = []
            for entry in os.scandir(p):
                items.append(
                    {
                        "name": entry.name,
                        "is_dir": entry.is_dir(),
                        "size": 0 if entry.is_dir() else entry.stat().st_size,
                    }
                )
            return json.dumps(
                sorted(items, key=lambda x: (not x["is_dir"], x["name"])),
                ensure_ascii=False,
            )
        except Exception as e:
            return f"[error] {e}"

    return f"[error] Unknown tool: {name}"


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _nexus_ai_stream(messages: list):
    """Stream via Nexus AI engine when Anthropic key is absent.

    Nexus AI handles tool execution internally — Nexus Computer acts as a
    thin client.  SSE events coming from Nexus AI are mapped to the same
    format the Nexus Computer frontend expects.
    """
    # Last user message becomes the task; prior turns are sent as history.
    turns = [{"role": m["role"], "content": m["content"]} for m in messages]
    history = turns[:-1]
    task = turns[-1]["content"] if turns else ""

    url = f"{_NEXUS_AI_URL}/agent/stream"
    payload = json.dumps({"task": task, "session_id": None, "files": []})

    intro = f"[Nexus AI engine — {_NEXUS_AI_URL}]\n"
    yield _sse({"type": "text", "content": intro})

    try:
        async with httpx.AsyncClient(timeout=120.0) as http:
            async with http.stream("POST", url,
                                   content=payload,
                                   headers={"Content-Type": "application/json"}) as resp:
                resp.raise_for_status()
                async for raw_line in resp.aiter_lines():
                    if not raw_line.startswith("data:"):
                        continue
                    data_str = raw_line[5:].strip()
                    if not data_str:
                        continue
                    try:
                        evt = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    etype = evt.get("type", "")
                    if etype == "done":
                        content = evt.get("content", "")
                        if content:
                            yield _sse({"type": "text", "content": content})
                        yield _sse({"type": "done"})
                        return
                    elif etype == "think":
                        thought = evt.get("thought", "")
                        if thought:
                            yield _sse({"type": "text", "content": f"💭 {thought}\n"})
                    elif etype == "tool":
                        action = evt.get("action", "tool")
                        icon = evt.get("icon", "🔧")
                        result = evt.get("result", "")
                        yield _sse({"type": "tool_use", "name": action,
                                    "input": {"action": action, "result": result, "icon": icon}})
                    elif etype == "error":
                        yield _sse({"type": "text", "content": f"❌ {evt.get('message', 'Error')}\n"})
                        yield _sse({"type": "done"})
                        return
    except Exception as e:
        yield _sse({"type": "text", "content": f"❌ Nexus AI connection failed: {e}\n"})
        yield _sse({"type": "done"})


async def run_agent_stream(messages: list, workspace: str):
    """Agentic loop with SSE streaming.

    Routes to Nexus AI when NEXUS_AI_URL is set and ANTHROPIC_API_KEY is absent.
    """
    # ── Nexus AI path ──────────────────────────────────────────────────────
    if not _ANTHROPIC_KEY and _NEXUS_AI_URL:
        async for chunk in _nexus_ai_stream(messages):
            yield chunk
        return

    if client is None:
        yield _sse({"type": "text", "content": "❌ No AI engine configured. Set NEXUS_AI_URL or ANTHROPIC_API_KEY.\n"})
        yield _sse({"type": "done"})
        return

    # ── Anthropic path (default) ───────────────────────────────────────────
    anthropic_messages = [{"role": m["role"], "content": m["content"]} for m in messages]

    while True:
        collected_text = ""
        final_content = []

        with client.messages.stream(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=anthropic_messages,
        ) as stream:
            for event in stream:
                t = getattr(event, "type", None)
                if t == "content_block_delta":
                    delta = getattr(event, "delta", None)
                    if delta and hasattr(delta, "text"):
                        collected_text += delta.text
                        yield _sse({"type": "text", "content": delta.text})

            msg = stream.get_final_message()
            final_content = msg.content
            stop_reason = msg.stop_reason

        tool_uses = [b for b in final_content if b.type == "tool_use"]

        if stop_reason == "end_turn" or not tool_uses:
            yield _sse({"type": "done"})
            break

        if stop_reason == "tool_use":
            assistant_blocks = []
            if collected_text:
                assistant_blocks.append({"type": "text", "text": collected_text})
            for tu in tool_uses:
                assistant_blocks.append(
                    {"type": "tool_use", "id": tu.id, "name": tu.name, "input": tu.input}
                )
            anthropic_messages.append({"role": "assistant", "content": assistant_blocks})

            tool_results = []
            for tu in tool_uses:
                yield _sse({"type": "tool_use", "name": tu.name, "input": tu.input})
                result = _execute_tool(tu.name, tu.input, workspace)
                yield _sse({"type": "tool_result", "name": tu.name, "result": result[:1000]})
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": tu.id, "content": result}
                )

            anthropic_messages.append({"role": "user", "content": tool_results})
            continue

        yield _sse({"type": "done"})
        break
