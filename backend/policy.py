import json
import os


def default_policy() -> dict:
    return {
        "mode": "monitor",
        "protected_paths": [".nexus", ".git"],
        "rules": {
            "write": "allow",
            "delete": "confirm",
            "bash_destructive": "confirm",
        },
    }


def policy_file_path(workspace: str) -> str:
    return os.path.join(workspace, ".nexus", "policy.json")


def ensure_policy(workspace: str) -> dict:
    path = policy_file_path(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        policy = default_policy()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(policy, f, indent=2, ensure_ascii=False)
        return policy
    return load_policy(workspace)


def load_policy(workspace: str) -> dict:
    path = policy_file_path(workspace)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("invalid policy")
        merged = default_policy()
        merged.update(data)
        if isinstance(data.get("rules"), dict):
            merged["rules"].update(data["rules"])
        if not isinstance(merged.get("protected_paths"), list):
            merged["protected_paths"] = default_policy()["protected_paths"]
        return merged
    except Exception:
        return ensure_policy(workspace)


def _norm(path: str) -> str:
    return (path or "").replace("\\", "/").lstrip("/")


def is_protected_path(path: str, policy: dict) -> bool:
    target = _norm(path)
    for protected in policy.get("protected_paths", []):
        p = _norm(str(protected))
        if not p:
            continue
        if target == p or target.startswith(p + "/"):
            return True
    return False


def is_destructive_command(command: str) -> bool:
    cmd = (command or "").lower()
    markers = [" rm ", " rm-", " rm\t", "rmdir ", "mv ", "truncate ", "chmod ", "chown "]
    if "rm -rf" in cmd or "rm -f" in cmd:
        return True
    return any(marker in f" {cmd} " for marker in markers)


def policy_decision(policy: dict, action: str) -> str:
    mode = str(policy.get("mode", "monitor")).lower()
    rule = str(policy.get("rules", {}).get(action, "allow")).lower()
    if mode == "allow":
        return "allow"
    if mode == "confirm" and rule in {"confirm", "deny"}:
        return rule
    if mode == "monitor":
        return "allow"
    return rule if rule in {"allow", "confirm", "deny"} else "allow"
