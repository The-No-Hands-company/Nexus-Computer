import json
import os
import shutil
import tarfile
import tempfile
import uuid
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _data_dir(workspace: str) -> str:
    path = os.path.join(workspace, ".nexus")
    os.makedirs(path, exist_ok=True)
    return path


def snapshots_dir(workspace: str) -> str:
    path = os.path.join(_data_dir(workspace), "snapshots")
    os.makedirs(path, exist_ok=True)
    return path


def _index_path(workspace: str) -> str:
    return os.path.join(_data_dir(workspace), "snapshots.json")


def _load_index(workspace: str) -> list[dict]:
    path = _index_path(workspace)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_index(workspace: str, items: list[dict]) -> None:
    with open(_index_path(workspace), "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


def _skip_in_archive(path: str, snapshots_root: str) -> bool:
    try:
        rp = os.path.realpath(path)
        rr = os.path.realpath(snapshots_root)
        return os.path.commonpath([rp, rr]) == rr
    except Exception:
        return False


def create_snapshot(workspace: str, label: str = "") -> dict:
    snap_id = uuid.uuid4().hex
    created_at = _now()
    safe_label = (label or "").strip() or f"snapshot-{created_at[:19]}"
    archive_path = os.path.join(snapshots_dir(workspace), f"{snap_id}.tar.gz")
    snapshots_root = snapshots_dir(workspace)

    with tarfile.open(archive_path, "w:gz") as tar:
        for root, dirs, files in os.walk(workspace):
            dirs[:] = [d for d in dirs if not _skip_in_archive(os.path.join(root, d), snapshots_root)]
            for file_name in files:
                full = os.path.join(root, file_name)
                if _skip_in_archive(full, snapshots_root):
                    continue
                rel = os.path.relpath(full, workspace)
                tar.add(full, arcname=rel)

    item = {
        "id": snap_id,
        "label": safe_label,
        "archive": os.path.relpath(archive_path, workspace).replace(os.sep, "/"),
        "created_at": created_at,
        "size_bytes": os.path.getsize(archive_path),
    }
    items = _load_index(workspace)
    items.insert(0, item)
    _save_index(workspace, items)
    return item


def list_snapshots(workspace: str) -> dict:
    items = _load_index(workspace)
    return {"items": items, "count": len(items)}


def restore_snapshot(workspace: str, snapshot_id: str) -> dict:
    items = _load_index(workspace)
    item = next((i for i in items if i.get("id") == snapshot_id), None)
    if not item:
        raise FileNotFoundError("snapshot not found")

    archive_rel = item.get("archive", "")
    archive_path = os.path.realpath(os.path.join(workspace, archive_rel))
    if not os.path.exists(archive_path):
        raise FileNotFoundError("snapshot archive not found")

    snaps_root = os.path.realpath(snapshots_dir(workspace))

    with tempfile.TemporaryDirectory(prefix="nexus-restore-") as tmp:
        with tarfile.open(archive_path, "r:gz") as tar:
            tar.extractall(tmp)

        for entry in os.listdir(workspace):
            full = os.path.realpath(os.path.join(workspace, entry))
            if os.path.commonpath([full, snaps_root]) == snaps_root:
                continue
            if os.path.isdir(full):
                shutil.rmtree(full)
            else:
                os.remove(full)

        for entry in os.listdir(tmp):
            src = os.path.join(tmp, entry)
            dst = os.path.join(workspace, entry)
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                os.makedirs(os.path.dirname(dst) or workspace, exist_ok=True)
                shutil.copy2(src, dst)

    return {
        "status": "restored",
        "snapshot": item,
        "restored_at": _now(),
    }
