import os
import shutil
from fastapi import HTTPException
from policy import load_policy, is_protected_path, policy_decision


def _safe(workspace: str, path: str) -> str:
    """Resolve and verify path stays within workspace."""
    workspace_real = os.path.realpath(workspace)
    resolved = os.path.realpath(os.path.join(workspace_real, path.lstrip("/")))
    if os.path.commonpath([workspace_real, resolved]) != workspace_real:
        raise HTTPException(status_code=403, detail="Path traversal denied")
    return resolved


def _looks_binary(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(4096)
        return b"\x00" in chunk
    except Exception:
        return True


def search_files_api(workspace: str, query: str, path: str = "", limit: int = 50):
    try:
        query = (query or "").strip()
        if not query:
            return {"query": query, "path": path, "items": []}

        target = _safe(workspace, path)
        if not os.path.exists(target):
            return {"query": query, "path": path, "items": []}

        q = query.lower()
        items = []
        max_bytes = 250_000

        for root, dirs, files in os.walk(target):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "dist", "Trash"}]
            for name in files:
                full = os.path.join(root, name)
                rel = os.path.relpath(full, workspace).replace(os.sep, "/")
                rel_in_scope = os.path.relpath(full, target).replace(os.sep, "/")
                name_match = q in name.lower() or q in rel.lower()
                snippet = ""
                content_match = False
                if not _looks_binary(full):
                    try:
                        if os.path.getsize(full) <= max_bytes:
                            with open(full, "r", errors="replace") as f:
                                content = f.read(max_bytes)
                            lowered = content.lower()
                            idx = lowered.find(q)
                            if idx != -1:
                                content_match = True
                                start = max(0, idx - 80)
                                end = min(len(content), idx + len(query) + 160)
                                snippet = content[start:end].replace("\n", " ").strip()
                    except Exception:
                        pass

                if name_match or content_match:
                    items.append({
                        "path": rel,
                        "name": name,
                        "scope_path": rel_in_scope,
                        "type": "content" if content_match and not name_match else "path",
                        "snippet": snippet,
                    })
                    if len(items) >= limit:
                        break
            if len(items) >= limit:
                break

        return {"query": query, "path": path, "items": items}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def list_files_api(workspace: str, path: str = ""):
    try:
        target = _safe(workspace, path)
        if not os.path.exists(target):
            return {"items": [], "path": path}

        items = []
        for entry in os.scandir(target):
            items.append(
                {
                    "name": entry.name,
                    "path": os.path.join(path, entry.name).lstrip("/"),
                    "is_dir": entry.is_dir(),
                    "size": 0 if entry.is_dir() else entry.stat().st_size,
                    "modified": entry.stat().st_mtime,
                }
            )

        return {
            "items": sorted(items, key=lambda x: (not x["is_dir"], x["name"])),
            "path": path,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def read_file_api(workspace: str, path: str):
    try:
        target = _safe(workspace, path)
        with open(target, "r", errors="replace") as f:
            content = f.read()
        return {"path": path, "content": content}
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def write_file_api(workspace: str, path: str, content: str):
    try:
        policy = load_policy(workspace)
        decision = policy_decision(policy, "write")
        rel = path.lstrip("/")
        if is_protected_path(rel, policy):
            raise HTTPException(status_code=403, detail="policy denied write to protected path")
        if decision == "deny":
            raise HTTPException(status_code=403, detail="policy denied write action")
        if decision == "confirm":
            raise HTTPException(status_code=409, detail="write requires confirmation by policy")

        target = _safe(workspace, path)
        parent = os.path.dirname(target)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(target, "w") as f:
            f.write(content)
        return {"path": path, "status": "written"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def delete_file_api(workspace: str, path: str):
    try:
        policy = load_policy(workspace)
        decision = policy_decision(policy, "delete")
        rel = path.lstrip("/")
        if is_protected_path(rel, policy):
            raise HTTPException(status_code=403, detail="policy denied delete on protected path")
        if decision == "deny":
            raise HTTPException(status_code=403, detail="policy denied delete action")
        if decision == "confirm":
            raise HTTPException(status_code=409, detail="delete requires confirmation by policy")

        target = _safe(workspace, path)
        if os.path.isdir(target):
            shutil.rmtree(target)
        else:
            os.remove(target)
        return {"path": path, "status": "deleted"}
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
