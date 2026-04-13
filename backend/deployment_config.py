"""
Deployment configuration for Nexus Computer.

Nexus Computer can be deployed in two modes:
1. Standalone: Self-hosted with optional federation/peering
2. Hub-integrated: Running as part of Nexus Cloud

This module manages the deployment mode, node identity, federation settings,
and deployment metadata.
"""

import os
import json
from pathlib import Path
from datetime import datetime, timezone


def _now():
    """Return current ISO timestamp."""
    return datetime.now(timezone.utc).isoformat()


def ensure_deployment_config(workspace_dir: str):
    """Initialize deployment configuration if it doesn't exist."""
    data_dir = Path(workspace_dir) / ".nexus"
    config_file = data_dir / "deployment.json"

    if config_file.exists():
        return

    # Default to standalone mode
    config = {
        "mode": "standalone",  # "standalone" or "hub-integrated"
        "node_id": "",  # Generated node ID for federation
        "federation_enabled": False,
        "hub_connection": None,  # Details if hub-integrated
        "created_at": _now(),
    }

    config_file.write_text(json.dumps(config, indent=2))


def load_deployment_config(workspace_dir: str) -> dict:
    """Load deployment configuration."""
    ensure_deployment_config(workspace_dir)
    data_dir = Path(workspace_dir) / ".nexus"
    config_file = data_dir / "deployment.json"
    return json.loads(config_file.read_text())


def save_deployment_config(workspace_dir: str, config: dict):
    """Save deployment configuration."""
    data_dir = Path(workspace_dir) / ".nexus"
    config_file = data_dir / "deployment.json"
    config_file.write_text(json.dumps(config, indent=2))


def get_deployment_status(workspace_dir: str) -> dict:
    """Get complete deployment status for UI display."""
    config = load_deployment_config(workspace_dir)

    return {
        "mode": config.get("mode", "standalone"),
        "node_id": config.get("node_id", ""),
        "federation": {
            "enabled": config.get("federation_enabled", False),
            "peers": [],  # TODO: Load from federation registry
        },
        "hub": {
            "connected": config.get("hub_connection") is not None,
            "url": config.get("hub_connection", {}).get("url") if config.get("hub_connection") else None,
        },
    }


def set_deployment_mode(workspace_dir: str, mode: str) -> dict:
    """Set the deployment mode (standalone or hub-integrated)."""
    if mode not in ("standalone", "hub-integrated"):
        raise ValueError("mode must be 'standalone' or 'hub-integrated'")

    config = load_deployment_config(workspace_dir)
    config["mode"] = mode
    save_deployment_config(workspace_dir, config)
    return get_deployment_status(workspace_dir)


def enable_federation(workspace_dir: str, node_id: str = None) -> dict:
    """Enable federation for standalone mode."""
    if not node_id:
        import uuid
        node_id = uuid.uuid4().hex[:12]

    config = load_deployment_config(workspace_dir)
    config["federation_enabled"] = True
    config["node_id"] = node_id
    save_deployment_config(workspace_dir, config)
    return get_deployment_status(workspace_dir)


def disable_federation(workspace_dir: str) -> dict:
    """Disable federation."""
    config = load_deployment_config(workspace_dir)
    config["federation_enabled"] = False
    save_deployment_config(workspace_dir, config)
    return get_deployment_status(workspace_dir)
