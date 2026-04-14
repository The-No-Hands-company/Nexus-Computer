import json
import os
import signal
import socket
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from urllib import request as urllib_request
from urllib import error as urllib_error


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _services_file(workspace: str) -> str:
    return os.path.join(workspace, ".nexus", "hosted-services.json")


def _logs_dir(workspace: str) -> str:
    return os.path.join(workspace, ".nexus", "service-logs")


def _service_log_path(workspace: str, service_id: str) -> str:
    return os.path.join(_logs_dir(workspace), f"{service_id}.log")


def ensure_services_store(workspace: str) -> None:
    path = _services_file(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    os.makedirs(_logs_dir(workspace), exist_ok=True)
    if os.path.exists(path):
        return
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"items": []}, f, indent=2, ensure_ascii=False)


def load_services(workspace: str) -> dict:
    ensure_services_store(workspace)
    path = _services_file(workspace)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "items" not in data:
            raise ValueError("invalid services store")
        return data
    except Exception:
        data = {"items": []}
        save_services(workspace, data)
        return data


def save_services(workspace: str, data: dict) -> None:
    path = _services_file(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def create_service(
    workspace: str,
    name: str,
    command: str,
    port: int | None,
    cwd: str,
    autostart: bool,
    probe_path: str,
    expected_status: int,
    probe_interval_seconds: int = 30,
    probe_timeout_seconds: int = 2,
) -> dict:
    data = load_services(workspace)
    now = _now()
    item = {
        "id": uuid.uuid4().hex,
        "name": name.strip(),
        "command": command.strip(),
        "port": int(port) if port else None,
        "cwd": (cwd or "").strip(),
        "autostart": bool(autostart),
        "probe_path": (probe_path or "/").strip() or "/",
        "expected_status": int(expected_status),
        "status": "stopped",
        "pid": None,
        "running_since": None,
        "uptime_seconds": 0,
        "last_exit_code": None,
        "last_error": "",
        "last_probe_at": None,
        "last_probe_latency_ms": None,
        "last_probe_status_code": None,
        "probe_healthy": None,
        "probe_consecutive_failures": 0,
        "probe_interval_seconds": max(5, int(probe_interval_seconds)),
        "probe_timeout_seconds": max(1, int(probe_timeout_seconds)),
        "last_success_at": None,
        "probe_total_checks": 0,
        "probe_successful_checks": 0,
        "availability_pct": None,
        "created_at": now,
        "updated_at": now,
    }
    data.setdefault("items", []).insert(0, item)
    save_services(workspace, data)
    return item


def update_service(
    workspace: str,
    service_id: str,
    name: str | None,
    command: str | None,
    port: int | None,
    cwd: str | None,
    autostart: bool | None,
    probe_path: str | None,
    expected_status: int | None,
    probe_interval_seconds: int | None = None,
    probe_timeout_seconds: int | None = None,
) -> dict:
    data = load_services(workspace)
    for item in data.get("items", []):
        if item.get("id") != service_id:
            continue
        if name is not None:
            item["name"] = name.strip()
        if command is not None:
            item["command"] = command.strip()
        if port is not None:
            item["port"] = int(port)
        if cwd is not None:
            item["cwd"] = cwd.strip()
        if autostart is not None:
            item["autostart"] = bool(autostart)
        if probe_path is not None:
            item["probe_path"] = (probe_path or "/").strip() or "/"
        if expected_status is not None:
            item["expected_status"] = int(expected_status)
        if probe_interval_seconds is not None:
            item["probe_interval_seconds"] = max(5, int(probe_interval_seconds))
        if probe_timeout_seconds is not None:
            item["probe_timeout_seconds"] = max(1, int(probe_timeout_seconds))
        item["updated_at"] = _now()
        save_services(workspace, data)
        return item
    raise FileNotFoundError("service not found")


def delete_service(workspace: str, service_id: str) -> None:
    data = load_services(workspace)
    before = len(data.get("items", []))
    data["items"] = [i for i in data.get("items", []) if i.get("id") != service_id]
    if len(data["items"]) == before:
        raise FileNotFoundError("service not found")
    save_services(workspace, data)


def _is_pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _is_port_open(port: int | None) -> bool:
    if not port:
        return False
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.3)
    try:
        return sock.connect_ex(("127.0.0.1", int(port))) == 0
    finally:
        sock.close()


def _probe_http(port: int | None, path: str, expected_status: int, timeout: float = 2.0) -> dict:
    if not port:
        return {
            "healthy": False,
            "status_code": None,
            "latency_ms": None,
            "error": "port not configured",
        }
    probe_path = path if path.startswith("/") else f"/{path}"
    url = f"http://127.0.0.1:{int(port)}{probe_path}"
    started = time.time()
    try:
        req = urllib_request.Request(url=url, method="GET")
        with urllib_request.urlopen(req, timeout=max(0.5, float(timeout))) as resp:
            code = int(resp.getcode())
        latency = int((time.time() - started) * 1000)
        return {
            "healthy": code == int(expected_status),
            "status_code": code,
            "latency_ms": latency,
            "error": "",
        }
    except urllib_error.HTTPError as e:
        latency = int((time.time() - started) * 1000)
        code = int(e.code)
        return {
            "healthy": code == int(expected_status),
            "status_code": code,
            "latency_ms": latency,
            "error": str(e),
        }
    except Exception as e:
        latency = int((time.time() - started) * 1000)
        return {
            "healthy": False,
            "status_code": None,
            "latency_ms": latency,
            "error": str(e),
        }


def read_service_logs(workspace: str, service_id: str, lines: int = 120) -> list[str]:
    path = _service_log_path(workspace, service_id)
    if not os.path.exists(path):
        return []
    rows = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            rows.append(line.rstrip("\n"))
    return rows[-max(1, min(lines, 1000)):]


class HostedServiceManager:
    def __init__(self, workspace: str):
        self.workspace = workspace
        self._lock = threading.Lock()

    def _safe_cwd(self, cwd: str) -> str:
        if not cwd:
            return self.workspace
        abs_cwd = os.path.abspath(os.path.join(self.workspace, cwd))
        workspace_abs = os.path.abspath(self.workspace)
        if not (abs_cwd == workspace_abs or abs_cwd.startswith(workspace_abs + os.sep)):
            raise ValueError("cwd must stay within workspace")
        os.makedirs(abs_cwd, exist_ok=True)
        return abs_cwd

    def refresh(self) -> dict:
        with self._lock:
            data = load_services(self.workspace)
            changed = False
            for item in data.get("items", []):
                if "probe_path" not in item:
                    item["probe_path"] = "/"
                    changed = True
                if "expected_status" not in item:
                    item["expected_status"] = 200
                    changed = True
                if "probe_interval_seconds" not in item:
                    item["probe_interval_seconds"] = 30
                    changed = True
                if "probe_timeout_seconds" not in item:
                    item["probe_timeout_seconds"] = 2
                    changed = True
                if "last_success_at" not in item:
                    item["last_success_at"] = None
                    changed = True
                if "probe_total_checks" not in item:
                    item["probe_total_checks"] = 0
                    changed = True
                if "probe_successful_checks" not in item:
                    item["probe_successful_checks"] = 0
                    changed = True
                if "availability_pct" not in item:
                    item["availability_pct"] = None
                    changed = True
                pid = item.get("pid")
                running = _is_pid_alive(pid)
                port = item.get("port")
                item["port_open"] = _is_port_open(port)
                if running and item.get("status") != "running":
                    item["status"] = "running"
                    changed = True
                if not running and item.get("status") == "running":
                    item["status"] = "stopped"
                    item["pid"] = None
                    item["uptime_seconds"] = 0
                    item["probe_healthy"] = None
                    changed = True

                if running and item.get("running_since"):
                    try:
                        started = datetime.fromisoformat(item.get("running_since")).timestamp()
                        item["uptime_seconds"] = max(0, int(time.time() - started))
                        changed = True
                    except Exception:
                        item["uptime_seconds"] = 0

                if running and item.get("port") and item.get("port_open"):
                    probe_interval = int(item.get("probe_interval_seconds") or 30)
                    last_probe_ts = item.get("last_probe_at")
                    should_probe = True
                    if last_probe_ts:
                        try:
                            elapsed = time.time() - datetime.fromisoformat(last_probe_ts).timestamp()
                            should_probe = elapsed >= probe_interval
                        except Exception:
                            should_probe = True
                    if should_probe:
                        probe_timeout = float(item.get("probe_timeout_seconds") or 2)
                        probe = _probe_http(
                            item.get("port"),
                            item.get("probe_path") or "/",
                            int(item.get("expected_status") or 200),
                            timeout=probe_timeout,
                        )
                        item["last_probe_at"] = _now()
                        item["last_probe_latency_ms"] = probe.get("latency_ms")
                        item["last_probe_status_code"] = probe.get("status_code")
                        item["probe_healthy"] = probe.get("healthy")
                        total = int(item.get("probe_total_checks") or 0) + 1
                        item["probe_total_checks"] = total
                        if probe.get("healthy"):
                            item["probe_consecutive_failures"] = 0
                            item["probe_successful_checks"] = int(item.get("probe_successful_checks") or 0) + 1
                            item["last_success_at"] = _now()
                        else:
                            item["probe_consecutive_failures"] = int(item.get("probe_consecutive_failures") or 0) + 1
                        successful = int(item.get("probe_successful_checks") or 0)
                        item["availability_pct"] = round((successful / total) * 100, 1)
                        item["last_error"] = probe.get("error") or ""
                        changed = True
            if changed:
                save_services(self.workspace, data)
            return data

    def start(self, service_id: str) -> dict:
        with self._lock:
            data = load_services(self.workspace)
            target = None
            for item in data.get("items", []):
                if item.get("id") == service_id:
                    target = item
                    break
            if not target:
                raise FileNotFoundError("service not found")

            if _is_pid_alive(target.get("pid")):
                target["status"] = "running"
                save_services(self.workspace, data)
                return target

            command = (target.get("command") or "").strip()
            if not command:
                raise ValueError("service command cannot be empty")

            cwd = self._safe_cwd(target.get("cwd") or "")
            log_path = _service_log_path(self.workspace, target["id"])
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
            log_file = open(log_path, "a", encoding="utf-8")
            log_file.write(f"\n[{_now()}] Starting service: {target.get('name')}\n")
            log_file.flush()

            proc = subprocess.Popen(
                command,
                shell=True,
                cwd=cwd,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                preexec_fn=os.setsid,
            )
            time.sleep(0.2)

            target["pid"] = proc.pid
            target["status"] = "running" if _is_pid_alive(proc.pid) else "error"
            target["running_since"] = _now() if target["status"] == "running" else None
            target["last_error"] = "" if target["status"] == "running" else "failed to start"
            target["updated_at"] = _now()
            save_services(self.workspace, data)
            return target

    def stop(self, service_id: str) -> dict:
        with self._lock:
            data = load_services(self.workspace)
            target = None
            for item in data.get("items", []):
                if item.get("id") == service_id:
                    target = item
                    break
            if not target:
                raise FileNotFoundError("service not found")

            pid = target.get("pid")
            if pid and _is_pid_alive(pid):
                try:
                    os.killpg(pid, signal.SIGTERM)
                    for _ in range(25):
                        if not _is_pid_alive(pid):
                            break
                        time.sleep(0.1)
                    if _is_pid_alive(pid):
                        os.killpg(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass

            target["status"] = "stopped"
            target["pid"] = None
            target["running_since"] = None
            target["updated_at"] = _now()
            save_services(self.workspace, data)
            return target

    def restart(self, service_id: str) -> dict:
        self.stop(service_id)
        return self.start(service_id)

    def autostart(self) -> None:
        data = self.refresh()
        for item in data.get("items", []):
            if item.get("autostart") and item.get("status") != "running":
                try:
                    self.start(item.get("id"))
                except Exception:
                    continue

    def stop_all(self) -> None:
        data = self.refresh()
        for item in data.get("items", []):
            if item.get("status") == "running":
                try:
                    self.stop(item.get("id"))
                except Exception:
                    continue
