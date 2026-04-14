import json
import os
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone

from policy import load_policy, policy_decision, is_destructive_command


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _jobs_file(workspace: str) -> str:
    return os.path.join(workspace, ".nexus", "automation-jobs.json")


def _logs_file(workspace: str) -> str:
    return os.path.join(workspace, ".nexus", "automation-logs.jsonl")


def ensure_automation_store(workspace: str) -> None:
    path = _jobs_file(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        return
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"items": []}, f, indent=2, ensure_ascii=False)


def load_jobs(workspace: str) -> dict:
    ensure_automation_store(workspace)
    path = _jobs_file(workspace)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "items" not in data:
            raise ValueError("invalid jobs store")
        return data
    except Exception:
        data = {"items": []}
        save_jobs(workspace, data)
        return data


def save_jobs(workspace: str, data: dict) -> None:
    path = _jobs_file(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def append_log(workspace: str, item: dict) -> None:
    path = _logs_file(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")


def list_logs(workspace: str, limit: int = 100) -> list[dict]:
    path = _logs_file(workspace)
    if not os.path.exists(path):
        return []
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows[-limit:][::-1]


def create_job(workspace: str, name: str, command: str, interval_seconds: int, enabled: bool = True) -> dict:
    data = load_jobs(workspace)
    now = _now()
    item = {
        "id": uuid.uuid4().hex,
        "name": name.strip(),
        "command": command.strip(),
        "interval_seconds": max(30, int(interval_seconds)),
        "enabled": bool(enabled),
        "last_run_at": None,
        "next_run_at": now,
        "last_status": "idle",
        "created_at": now,
        "updated_at": now,
    }
    data.setdefault("items", []).insert(0, item)
    save_jobs(workspace, data)
    return item


def update_job(workspace: str, job_id: str, name: str | None, command: str | None, interval_seconds: int | None, enabled: bool | None) -> dict:
    data = load_jobs(workspace)
    for item in data.get("items", []):
        if item.get("id") != job_id:
            continue
        if name is not None:
            item["name"] = name.strip()
        if command is not None:
            item["command"] = command.strip()
        if interval_seconds is not None:
            item["interval_seconds"] = max(30, int(interval_seconds))
        if enabled is not None:
            item["enabled"] = bool(enabled)
        item["updated_at"] = _now()
        save_jobs(workspace, data)
        return item
    raise FileNotFoundError("job not found")


def delete_job(workspace: str, job_id: str) -> None:
    data = load_jobs(workspace)
    before = len(data.get("items", []))
    data["items"] = [i for i in data.get("items", []) if i.get("id") != job_id]
    if len(data["items"]) == before:
        raise FileNotFoundError("job not found")
    save_jobs(workspace, data)


def run_job_once(workspace: str, job: dict) -> dict:
    cmd = (job.get("command") or "").strip()
    policy = load_policy(workspace)
    decision = policy_decision(policy, "bash_destructive")
    if is_destructive_command(cmd) and decision in {"confirm", "deny"}:
        result = {
            "status": "blocked",
            "output": f"policy blocked destructive command ({decision})",
            "exit_code": None,
        }
    else:
        try:
            proc = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                cwd=workspace,
                timeout=300,
            )
            output = (proc.stdout or "")
            if proc.stderr:
                output += f"\n[stderr]\n{proc.stderr}"
            result = {
                "status": "ok" if proc.returncode == 0 else "error",
                "output": output.strip()[:8000],
                "exit_code": proc.returncode,
            }
        except subprocess.TimeoutExpired:
            result = {
                "status": "timeout",
                "output": "command exceeded 300 seconds",
                "exit_code": None,
            }
        except Exception as e:
            result = {
                "status": "error",
                "output": str(e),
                "exit_code": None,
            }

    now = _now()
    log = {
        "id": uuid.uuid4().hex,
        "job_id": job.get("id"),
        "job_name": job.get("name"),
        "command": cmd,
        "status": result["status"],
        "exit_code": result.get("exit_code"),
        "output": result.get("output", ""),
        "created_at": now,
    }
    append_log(workspace, log)
    return log


class AutomationScheduler:
    def __init__(self, workspace: str):
        self.workspace = workspace
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception:
                pass
            self._stop.wait(5)

    def tick(self) -> None:
        with self._lock:
            data = load_jobs(self.workspace)
            items = data.get("items", [])
            now_ts = time.time()
            changed = False
            for job in items:
                if not job.get("enabled", False):
                    continue
                next_run_at = job.get("next_run_at")
                try:
                    next_ts = datetime.fromisoformat(next_run_at).timestamp() if next_run_at else 0
                except Exception:
                    next_ts = 0
                if next_ts > now_ts:
                    continue

                log = run_job_once(self.workspace, job)
                run_at = log.get("created_at")
                interval = max(30, int(job.get("interval_seconds", 60)))
                next_ts_new = time.time() + interval
                job["last_run_at"] = run_at
                job["last_status"] = log.get("status", "unknown")
                job["next_run_at"] = datetime.fromtimestamp(next_ts_new, timezone.utc).isoformat()
                job["updated_at"] = _now()
                changed = True
            if changed:
                save_jobs(self.workspace, data)

    def run_now(self, job_id: str) -> dict:
        with self._lock:
            data = load_jobs(self.workspace)
            for job in data.get("items", []):
                if job.get("id") != job_id:
                    continue
                log = run_job_once(self.workspace, job)
                interval = max(30, int(job.get("interval_seconds", 60)))
                next_ts_new = time.time() + interval
                job["last_run_at"] = log.get("created_at")
                job["last_status"] = log.get("status", "unknown")
                job["next_run_at"] = datetime.fromtimestamp(next_ts_new, timezone.utc).isoformat()
                job["updated_at"] = _now()
                save_jobs(self.workspace, data)
                return log
        raise FileNotFoundError("job not found")
