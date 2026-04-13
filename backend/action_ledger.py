import json
import os
import uuid
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_action_ledger(workspace: str) -> str:
    data_dir = os.path.join(workspace, ".nexus")
    os.makedirs(data_dir, exist_ok=True)
    ledger_path = os.path.join(data_dir, "actions.jsonl")
    if not os.path.exists(ledger_path):
        with open(ledger_path, "a", encoding="utf-8"):
            pass
    return ledger_path


def append_action(workspace: str, event: dict) -> dict:
    ledger_path = ensure_action_ledger(workspace)
    payload = {
        "id": event.get("id") or uuid.uuid4().hex,
        "created_at": event.get("created_at") or _now(),
        **event,
    }
    with open(ledger_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    return payload


def list_actions(workspace: str, limit: int = 100, offset: int = 0) -> dict:
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))
    ledger_path = ensure_action_ledger(workspace)
    events: list[dict] = []

    with open(ledger_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except Exception:
                continue

    events.reverse()
    sliced = events[offset: offset + limit]
    return {
        "items": sliced,
        "count": len(sliced),
        "total": len(events),
        "limit": limit,
        "offset": offset,
        "served_at": _now(),
    }
