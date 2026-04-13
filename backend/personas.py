import json
import os
import uuid
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _personas_file(workspace: str) -> str:
    return os.path.join(workspace, ".nexus", "personas.json")


def _default_personas() -> dict:
    items = [
        {
            "id": "developer",
            "name": "Developer",
            "description": "Build, debug, and ship robust software.",
            "system_prompt": "You are an expert software engineer. Prioritize correctness, tests, and clear implementation details.",
            "is_builtin": True,
            "created_at": _now(),
            "updated_at": _now(),
        },
        {
            "id": "writer",
            "name": "Writer",
            "description": "Write clear, polished technical and product copy.",
            "system_prompt": "You are a skilled writer. Produce concise, readable drafts with strong structure and tone.",
            "is_builtin": True,
            "created_at": _now(),
            "updated_at": _now(),
        },
        {
            "id": "analyst",
            "name": "Analyst",
            "description": "Analyze evidence, compare options, and surface tradeoffs.",
            "system_prompt": "You are a rigorous analyst. Show assumptions, quantify tradeoffs, and make evidence-based recommendations.",
            "is_builtin": True,
            "created_at": _now(),
            "updated_at": _now(),
        },
        {
            "id": "tutor",
            "name": "Tutor",
            "description": "Teach concepts step-by-step with practical examples.",
            "system_prompt": "You are a patient tutor. Explain concepts in small steps, check understanding, and adapt to the learner.",
            "is_builtin": True,
            "created_at": _now(),
            "updated_at": _now(),
        },
    ]
    return {
        "active_persona_id": "developer",
        "items": items,
    }


def ensure_personas(workspace: str) -> None:
    path = _personas_file(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        return
    with open(path, "w", encoding="utf-8") as f:
        json.dump(_default_personas(), f, indent=2, ensure_ascii=False)


def load_personas(workspace: str) -> dict:
    ensure_personas(workspace)
    path = _personas_file(workspace)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "items" not in data:
            raise ValueError("invalid personas file")
        return data
    except Exception:
        data = _default_personas()
        save_personas(workspace, data)
        return data


def save_personas(workspace: str, data: dict) -> None:
    path = _personas_file(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def list_personas(workspace: str) -> dict:
    return load_personas(workspace)


def get_persona(workspace: str, persona_id: str) -> dict | None:
    data = load_personas(workspace)
    for item in data.get("items", []):
        if item.get("id") == persona_id:
            return item
    return None


def create_persona(workspace: str, name: str, description: str, system_prompt: str) -> dict:
    data = load_personas(workspace)
    item = {
        "id": uuid.uuid4().hex,
        "name": name.strip(),
        "description": description.strip(),
        "system_prompt": system_prompt.strip(),
        "is_builtin": False,
        "created_at": _now(),
        "updated_at": _now(),
    }
    data["items"].insert(0, item)
    save_personas(workspace, data)
    return item


def update_persona(workspace: str, persona_id: str, name: str | None, description: str | None, system_prompt: str | None) -> dict:
    data = load_personas(workspace)
    for item in data.get("items", []):
        if item.get("id") == persona_id:
            if name is not None:
                item["name"] = name.strip()
            if description is not None:
                item["description"] = description.strip()
            if system_prompt is not None:
                item["system_prompt"] = system_prompt.strip()
            item["updated_at"] = _now()
            save_personas(workspace, data)
            return item
    raise FileNotFoundError("persona not found")


def delete_persona(workspace: str, persona_id: str) -> None:
    data = load_personas(workspace)
    items = data.get("items", [])
    target = None
    for item in items:
        if item.get("id") == persona_id:
            target = item
            break
    if target is None:
        raise FileNotFoundError("persona not found")
    if target.get("is_builtin"):
        raise ValueError("cannot delete builtin persona")

    data["items"] = [i for i in items if i.get("id") != persona_id]
    if data.get("active_persona_id") == persona_id:
        data["active_persona_id"] = "developer"
    save_personas(workspace, data)


def set_active_persona(workspace: str, persona_id: str) -> dict:
    data = load_personas(workspace)
    found = any(i.get("id") == persona_id for i in data.get("items", []))
    if not found:
        raise FileNotFoundError("persona not found")
    data["active_persona_id"] = persona_id
    save_personas(workspace, data)
    return data


def get_active_persona(workspace: str) -> dict:
    data = load_personas(workspace)
    active_id = data.get("active_persona_id")
    for item in data.get("items", []):
        if item.get("id") == active_id:
            return item
    return data.get("items", [])[0] if data.get("items") else {
        "id": "default",
        "name": "Default",
        "description": "Default Nexus persona",
        "system_prompt": "",
    }
