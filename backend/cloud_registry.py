"""
Cloud node registry for Nexus Computer.

Manages this node's identity and its relationships with Nexus Cloud hubs.

Nexusclaw registration pattern:
  Hub → POST /api/cloud/register  { hub_id, hub_url, node_token, label }
  Node stores a hash of node_token, returns node identity + ack
  Node advertises itself at /.well-known/nexus-cloud (discovery doc)
  Hub fetches /api/cloud/discovery for full runtime state

The cloud-registry.json file stores the persistent node identity and
all hub registrations.  File permissions are restricted to owner-only
because it contains the node secret that authenticates this node to hubs.
"""

import hashlib
import json
import os
import secrets
import uuid
from datetime import datetime, timezone
SPEC_VERSION = "nexus-cloud/1"
NODE_TYPE = "nexus-computer"
NODE_VERSION = "0.1.0"
CAPABILITIES = [
    "chat",
    "file-system",
    "search",
    "automation",
    "hosted-services",
    "personas",
    "snapshots",
    "federation",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _registry_file(workspace: str) -> str:
    return os.path.join(workspace, ".nexus", "cloud-registry.json")


def ensure_cloud_registry(workspace: str) -> None:
    path = _registry_file(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        return
    data = {
        "node_id": uuid.uuid4().hex,
        # Secret used to sign/verify outbound requests to hubs.
        # Never expose this in API responses.
        "node_secret": secrets.token_hex(32),
        "created_at": _now(),
        "registrations": [],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def load_cloud_registry(workspace: str) -> dict:
    ensure_cloud_registry(workspace)
    path = _registry_file(workspace)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_cloud_registry(workspace: str, data: dict) -> None:
    path = _registry_file(workspace)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def get_node_id(workspace: str) -> str:
    return load_cloud_registry(workspace)["node_id"]


def get_node_secret(workspace: str) -> str:
    return load_cloud_registry(workspace)["node_secret"]


def get_well_known(workspace: str, base_url: str = "") -> dict:
    """
    Return the /.well-known/nexus-cloud discovery document.
    base_url is the scheme+host used by the caller (e.g. https://mynode.example.com).
    """
    registry = load_cloud_registry(workspace)
    return {
        "spec": SPEC_VERSION,
        "node_id": registry["node_id"],
        "node_type": NODE_TYPE,
        "name": "Nexus.computer",
        "version": NODE_VERSION,
        "capabilities": CAPABILITIES,
        "endpoints": {
            "well_known": "/.well-known/nexus-cloud",
            "discovery": "/api/cloud/discovery",
            "register": "/api/cloud/register",
            "health": "/api/health",
            "chat": "/api/chat",
            "services": "/api/services",
            "automation": "/api/automation/jobs",
        },
        "base_url": base_url,
        "created_at": registry["created_at"],
    }


def get_discovery(workspace: str, base_url: str = "", runtime: dict | None = None) -> dict:
    """
    Return the full /api/cloud/discovery document: well-known + runtime state.
    runtime is a dict of live counters (uptime_seconds, service_count, etc.)
    """
    doc = get_well_known(workspace, base_url)
    doc["runtime"] = runtime or {}
    doc["registrations"] = list_registrations(workspace)
    return doc


def register_hub(
    workspace: str,
    hub_id: str,
    hub_url: str,
    node_token: str,
    label: str = "",
    rotated_by: str = "hub_callback",
) -> dict:
    """
    Record a hub's registration with this node.
    node_token is presented by the hub; we store only its SHA-256 hash.
    Returns the registration record (without token hash).
    """
    if not hub_id or not hub_url or not node_token:
        raise ValueError("hub_id, hub_url, and node_token are required")

    registry = load_cloud_registry(workspace)
    now = _now()
    token_hash = hashlib.sha256(node_token.encode("utf-8")).hexdigest()

    # Update existing if already registered
    for reg in registry.get("registrations", []):
        if reg.get("hub_id") == hub_id:
            reg["hub_url"] = hub_url.strip()
            reg["label"] = label or reg.get("label", "")
            reg["node_token_hash"] = token_hash
            reg["last_seen_at"] = now
            reg["last_rotated_at"] = now
            reg["rotated_by"] = (rotated_by or "hub_callback").strip()
            save_cloud_registry(workspace, registry)
            return _safe_reg(reg)

    entry = {
        "id": uuid.uuid4().hex,
        "hub_id": hub_id.strip(),
        "hub_url": hub_url.strip(),
        "label": label.strip(),
        "node_token_hash": token_hash,
        "registered_at": now,
        "last_seen_at": now,
        "last_rotated_at": now,
        "rotated_by": (rotated_by or "hub_callback").strip(),
    }
    registry.setdefault("registrations", []).append(entry)
    save_cloud_registry(workspace, registry)
    return _safe_reg(entry)


def list_registrations(workspace: str) -> list[dict]:
    registry = load_cloud_registry(workspace)
    return [_safe_reg(r) for r in registry.get("registrations", [])]


def deregister_hub(workspace: str, hub_id: str) -> None:
    registry = load_cloud_registry(workspace)
    before = len(registry.get("registrations", []))
    registry["registrations"] = [
        r for r in registry.get("registrations", [])
        if r.get("hub_id") != hub_id
    ]
    if len(registry["registrations"]) == before:
        raise FileNotFoundError(f"no registration found for hub_id={hub_id}")
    save_cloud_registry(workspace, registry)


def rotate_hub_token(
    workspace: str,
    hub_id: str,
    new_token: str,
    rotated_by: str = "unknown",
) -> dict:
    """
    Replace the stored token hash for an existing hub registration.
    new_token is the new raw token; only its SHA-256 hash is persisted.
    Returns the updated registration record (without hash).
    """
    if not hub_id or not new_token:
        raise ValueError("hub_id and new_token are required")
    registry = load_cloud_registry(workspace)
    for reg in registry.get("registrations", []):
        if reg.get("hub_id") == hub_id:
            reg["node_token_hash"] = hashlib.sha256(new_token.encode("utf-8")).hexdigest()
            now = _now()
            reg["last_seen_at"] = now
            reg["last_rotated_at"] = now
            reg["rotated_by"] = (rotated_by or "unknown").strip()
            save_cloud_registry(workspace, registry)
            return _safe_reg(reg)
    raise FileNotFoundError(f"no registration found for hub_id={hub_id}")


def _safe_reg(reg: dict) -> dict:
    """Return registration dict without internal token hash."""
    return {k: v for k, v in reg.items() if k != "node_token_hash"}
