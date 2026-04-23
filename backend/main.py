from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import Literal
import hmac
import hashlib
import json
import os
import platform
import shutil
import time
import uuid
from datetime import datetime, timezone

from agent import run_agent_stream
from auth import (
    auth_configured, setup_password, verify_password,
    create_token, decode_token, require_auth, set_workspace,
)
from terminal import terminal_ws
from tools import list_files_api, read_file_api, write_file_api, delete_file_api, search_files_api, _safe
from action_ledger import ensure_action_ledger, list_actions, append_action
from policy import ensure_policy, load_policy
from snapshots import create_snapshot, list_snapshots, restore_snapshot
from search import SearchIndexer
from model_registry import list_models, get_model, get_default_model
from service_manager import (
    ensure_services_store,
    load_services,
    create_service,
    update_service,
    delete_service,
    read_service_logs,
    HostedServiceManager,
)
from automation import (
    ensure_automation_store,
    load_jobs,
    create_job,
    update_job,
    delete_job,
    list_logs,
    AutomationScheduler,
)
from personas import (
    ensure_personas,
    list_personas,
    get_persona,
    create_persona,
    update_persona,
    delete_persona,
    set_active_persona,
    get_active_persona,
)
from deployment_config import (
    ensure_deployment_config,
    get_deployment_status,
    set_deployment_mode,
    enable_federation,
    disable_federation,
)
from cloud_registry import (
    ensure_cloud_registry,
    get_well_known,
    get_discovery,
    get_node_secret,
    register_hub,
    list_registrations,
    deregister_hub,
    rotate_hub_token,
)

app = FastAPI(title="Nexus.computer API")

cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if cors_origins == ["*"] else cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE = os.environ.get("WORKSPACE_DIR", "/workspace")
os.makedirs(WORKSPACE, exist_ok=True)
set_workspace(WORKSPACE)
START_TIME = time.time()
DATA_DIR = os.path.join(WORKSPACE, ".nexus")
ACCOUNT_FILE = os.path.join(DATA_DIR, "account.json")
SESSIONS_FILE = os.path.join(DATA_DIR, "sessions.json")
PLUGINS_FILE = os.path.join(DATA_DIR, "plugins.json")
REQUESTS_FILE = os.path.join(DATA_DIR, "feature-requests.json")
ensure_policy(WORKSPACE)
ensure_action_ledger(WORKSPACE)
ensure_deployment_config(WORKSPACE)
ensure_personas(WORKSPACE)
ensure_automation_store(WORKSPACE)
ensure_services_store(WORKSPACE)
ensure_cloud_registry(WORKSPACE)
SEARCH_INDEXER = SearchIndexer(WORKSPACE)
AUTOMATION = AutomationScheduler(WORKSPACE)
SERVICES = HostedServiceManager(WORKSPACE)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    search: str | None = None
    session_id: str | None = None
    model_id: str | None = "nexus-ai"
    persona_id: str | None = None


class FileWriteRequest(BaseModel):
    path: str
    content: str


class SnapshotCreate(BaseModel):
    label: str = ""


class FeatureRequestCreate(BaseModel):
    title: str
    details: str = ""


class AccountUpdate(BaseModel):
    name: str | None = None
    handle: str | None = None
    bio: str | None = None


class SessionCreate(BaseModel):
    label: str


class PluginInstall(BaseModel):
    name: str
    source_url: str = ""
    description: str = ""
    entrypoint: str = ""


class PluginUpdate(BaseModel):
    name: str | None = None
    source_url: str | None = None
    description: str | None = None
    entrypoint: str | None = None


class PersonaCreate(BaseModel):
    name: str
    description: str = ""
    system_prompt: str


class PersonaUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None


class AutomationJobCreate(BaseModel):
    name: str
    command: str
    interval_seconds: int = 300
    enabled: bool = True


class AutomationJobUpdate(BaseModel):
    name: str | None = None
    command: str | None = None
    interval_seconds: int | None = None
    enabled: bool | None = None


class HostedServiceCreate(BaseModel):
    name: str
    command: str
    port: int | None = None
    cwd: str = ""
    autostart: bool = False
    probe_path: str = "/"
    expected_status: int = 200
    probe_interval_seconds: int = 30
    probe_timeout_seconds: int = 2


class HostedServiceUpdate(BaseModel):
    name: str | None = None
    command: str | None = None
    port: int | None = None
    cwd: str | None = None
    autostart: bool | None = None
    probe_path: str | None = None
    expected_status: int | None = None
    probe_interval_seconds: int | None = None
    probe_timeout_seconds: int | None = None


class CloudRegistrationRequest(BaseModel):
    hub_id: str
    hub_url: str
    node_token: str
    label: str = ""


class CloudTokenRotateRequest(BaseModel):
    node_token: str
    rotated_by: str = "local_operator"


class CloudTokenRotateByHubRequest(BaseModel):
    hub_id: str
    node_token: str
    rotated_by: str = "hub_callback"


class CloudManualRegistrationRequest(BaseModel):
    hub_id: str
    hub_url: str
    node_token: str
    label: str = ""
    rotated_by: str = "local_operator"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_json(path: str, fallback):
    try:
        with open(path, "r") as f:
            data = json.load(f)
        return data
    except FileNotFoundError:
        return fallback
    except Exception:
        return fallback


def _write_json(path: str, value) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(value, f, indent=2, ensure_ascii=False)


def _default_account() -> dict:
    return {
        "id": uuid.uuid4().hex,
        "name": "Nexus Operator",
        "handle": "local",
        "bio": "Private, local-first cloud computer user",
        "created_at": _now(),
    }


def _load_account() -> dict:
    account = _read_json(ACCOUNT_FILE, None)
    if not isinstance(account, dict):
        account = _default_account()
        _write_json(ACCOUNT_FILE, account)
    return account


def _save_account(account: dict) -> None:
    _write_json(ACCOUNT_FILE, account)


def _default_sessions() -> dict:
    session_id = uuid.uuid4().hex
    return {
        "active_session_id": session_id,
        "items": [
            {
                "id": session_id,
                "label": "Primary workspace",
                "created_at": _now(),
                "last_active_at": _now(),
            }
        ],
    }


def _load_sessions() -> dict:
    sessions = _read_json(SESSIONS_FILE, None)
    if not isinstance(sessions, dict) or "items" not in sessions:
        sessions = _default_sessions()
        _write_json(SESSIONS_FILE, sessions)
    if not sessions.get("active_session_id") and sessions.get("items"):
        sessions["active_session_id"] = sessions["items"][0]["id"]
        _write_json(SESSIONS_FILE, sessions)
    return sessions


def _save_sessions(sessions: dict) -> None:
    _write_json(SESSIONS_FILE, sessions)


def _default_plugins() -> list[dict]:
    return []


def _load_plugins() -> list[dict]:
    plugins = _read_json(PLUGINS_FILE, None)
    if not isinstance(plugins, list):
        plugins = _default_plugins()
        _write_json(PLUGINS_FILE, plugins)
    return plugins


def _save_plugins(plugins: list[dict]) -> None:
    _write_json(PLUGINS_FILE, plugins)


def _load_feature_requests() -> list[dict]:
    requests = _read_json(REQUESTS_FILE, None)
    return requests if isinstance(requests, list) else []


def _save_feature_requests(items: list[dict]) -> None:
    _write_json(REQUESTS_FILE, items)


def _sorted_feature_requests(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda x: (int(x.get("votes", 0)), x.get("created_at", "")), reverse=True)


def _find_feature_request(items: list[dict], request_id: str) -> dict | None:
    for item in items:
        if item.get("id") == request_id:
            return item
    return None


def _find_session(sessions: dict, session_id: str) -> dict | None:
    for item in sessions.get("items", []):
        if item.get("id") == session_id:
            return item
    return None


def _find_plugin(plugins: list[dict], plugin_id: str) -> dict | None:
    for item in plugins:
        if item.get("id") == plugin_id:
            return item
    return None


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.on_event("startup")
async def startup_event():
    """Initialize search index on startup."""
    try:
        status = SEARCH_INDEXER.get_status()
        if status["indexed_files"] == 0:
            # First run: build index in background (don't block startup)
            import threading
            threading.Thread(
                target=lambda: SEARCH_INDEXER.rebuild_from_workspace(),
                daemon=True
            ).start()
    except Exception as e:
        print(f"Search index initialization failed: {e}")

    try:
        AUTOMATION.start()
    except Exception as e:
        print(f"Automation scheduler failed to start: {e}")

    try:
        SERVICES.autostart()
    except Exception as e:
        print(f"Hosted service autostart failed: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    try:
        AUTOMATION.stop()
    except Exception:
        pass
    try:
        SERVICES.stop_all()
    except Exception:
        pass


@app.get("/api/health")
async def health():
    return {"status": "online", "workspace": WORKSPACE}


# ── Auth ───────────────────────────────────────────────────────────────────────

class AuthSetupRequest(BaseModel):
    password: str

class AuthLoginRequest(BaseModel):
    password: str


@app.get("/api/auth/status")
async def auth_status():
    return {"configured": auth_configured(WORKSPACE)}


@app.post("/api/auth/setup")
async def auth_setup(body: AuthSetupRequest):
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if not setup_password(WORKSPACE, body.password):
        raise HTTPException(400, "Auth already configured")
    return {"token": create_token(), "status": "configured"}


@app.post("/api/auth/login")
async def auth_login(body: AuthLoginRequest):
    if not verify_password(WORKSPACE, body.password):
        raise HTTPException(401, "Invalid password")
    return {"token": create_token()}


# ── Terminal WebSocket ─────────────────────────────────────────────────────────

@app.websocket("/api/terminal")
async def terminal_endpoint(websocket: WebSocket, token: str = ""):
    if auth_configured(WORKSPACE):
        try:
            decode_token(token)
        except Exception:
            await websocket.close(code=4001)
            return
    account = _load_account()
    username = account.get("handle", "nexus")
    await terminal_ws(websocket, WORKSPACE, username=username)


@app.get("/api/meta")
async def meta():
    usage = shutil.disk_usage(WORKSPACE)
    account = _load_account()
    sessions = _load_sessions()
    plugins = _load_plugins()
    feature_requests = _load_feature_requests()
    active_session = _find_session(sessions, sessions.get("active_session_id", ""))
    return {
        "name": "Nexus.computer",
        "model": os.environ.get("NEXUS_MODEL", "nexus-ai"),
        "workspace": WORKSPACE,
        "account_name": account.get("name", "Nexus Operator"),
        "active_session_label": active_session.get("label") if active_session else None,
        "feature_requests": len(feature_requests),
        "plugin_count": len(plugins),
        "session_count": len(sessions.get("items", [])),
        "uptime_seconds": int(time.time() - START_TIME),
        "platform": platform.platform(),
        "python": platform.python_version(),
        "disk": {
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
        },
        "values": [
            "free as in freedom",
            "privacy first",
            "no paywalls",
            "open source",
        ],
    }


@app.get("/api/account")
async def get_account():
    account = _load_account()
    sessions = _load_sessions()
    active_session = _find_session(sessions, sessions.get("active_session_id", ""))
    return {
        "account": account,
        "session_count": len(sessions.get("items", [])),
        "active_session": active_session,
    }


@app.post("/api/account")
async def update_account(body: AccountUpdate):
    account = _load_account()
    if body.name is not None and body.name.strip():
        account["name"] = body.name.strip()
    if body.handle is not None and body.handle.strip():
        account["handle"] = body.handle.strip()
    if body.bio is not None:
        account["bio"] = body.bio.strip()
    account["updated_at"] = _now()
    _save_account(account)
    return {"account": account}


@app.get("/api/sessions")
async def get_sessions():
    sessions = _load_sessions()
    return {
        "active_session_id": sessions.get("active_session_id"),
        "items": sessions.get("items", []),
    }


@app.post("/api/sessions")
async def create_session(body: SessionCreate):
    label = body.label.strip()
    if len(label) < 2:
        raise HTTPException(status_code=400, detail="label must be at least 2 characters")
    sessions = _load_sessions()
    item = {
        "id": uuid.uuid4().hex,
        "label": label,
        "created_at": _now(),
        "last_active_at": _now(),
    }
    sessions.setdefault("items", []).insert(0, item)
    sessions["active_session_id"] = item["id"]
    _save_sessions(sessions)
    return {"session": item, "active_session_id": item["id"]}


@app.post("/api/sessions/{session_id}/activate")
async def activate_session(session_id: str):
    sessions = _load_sessions()
    item = _find_session(sessions, session_id)
    if not item:
        raise HTTPException(status_code=404, detail="session not found")
    sessions["active_session_id"] = session_id
    item["last_active_at"] = _now()
    _save_sessions(sessions)
    return {"session": item, "active_session_id": session_id}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    sessions = _load_sessions()
    items = [item for item in sessions.get("items", []) if item.get("id") != session_id]
    if len(items) == len(sessions.get("items", [])):
        raise HTTPException(status_code=404, detail="session not found")
    sessions["items"] = items
    if sessions.get("active_session_id") == session_id:
        sessions["active_session_id"] = items[0]["id"] if items else None
    _save_sessions(sessions)
    return {"status": "deleted"}


@app.get("/api/plugins")
async def get_plugins():
    return {"items": _load_plugins()}


@app.post("/api/plugins")
async def install_plugin(body: PluginInstall):
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="name must be at least 2 characters")
    plugins = _load_plugins()
    item = {
        "id": uuid.uuid4().hex,
        "name": name,
        "source_url": body.source_url.strip(),
        "description": body.description.strip(),
        "entrypoint": body.entrypoint.strip(),
        "enabled": True,
        "installed_at": _now(),
    }
    plugins.insert(0, item)
    _save_plugins(plugins)
    return {"plugin": item}


@app.post("/api/plugins/{plugin_id}")
async def update_plugin(plugin_id: str, body: PluginUpdate):
    plugins = _load_plugins()
    item = _find_plugin(plugins, plugin_id)
    if not item:
        raise HTTPException(status_code=404, detail="plugin not found")
    if body.name is not None and body.name.strip():
        item["name"] = body.name.strip()
    if body.source_url is not None:
        item["source_url"] = body.source_url.strip()
    if body.description is not None:
        item["description"] = body.description.strip()
    if body.entrypoint is not None:
        item["entrypoint"] = body.entrypoint.strip()
    item["updated_at"] = _now()
    _save_plugins(plugins)
    return {"plugin": item}


@app.delete("/api/plugins/{plugin_id}")
async def uninstall_plugin(plugin_id: str):
    plugins = _load_plugins()
    next_plugins = [item for item in plugins if item.get("id") != plugin_id]
    if len(next_plugins) == len(plugins):
        raise HTTPException(status_code=404, detail="plugin not found")
    _save_plugins(next_plugins)
    return {"status": "deleted"}


@app.get("/api/feature-requests")
async def list_feature_requests():
    items = _load_feature_requests()
    return {"items": _sorted_feature_requests(items)}


@app.get("/api/actions")
async def get_actions(limit: int = 100, offset: int = 0):
    return list_actions(WORKSPACE, limit=limit, offset=offset)


@app.get("/api/policy")
async def get_policy():
    return load_policy(WORKSPACE)


@app.get("/api/snapshots")
async def get_snapshots():
    return list_snapshots(WORKSPACE)


@app.post("/api/snapshots")
async def make_snapshot(body: SnapshotCreate):
    item = create_snapshot(WORKSPACE, label=body.label)
    return {"snapshot": item}


@app.post("/api/snapshots/{snapshot_id}/restore")
async def restore_snapshot_by_id(snapshot_id: str):
    try:
        return restore_snapshot(WORKSPACE, snapshot_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/deployment")
async def get_deployment():
    """Get current deployment status."""
    return get_deployment_status(WORKSPACE)


class DeploymentModeUpdate(BaseModel):
    mode: Literal["standalone", "hub-integrated"]


@app.post("/api/deployment/mode")
async def update_deployment_mode(body: DeploymentModeUpdate):
    """Set the deployment mode."""
    try:
        return set_deployment_mode(WORKSPACE, body.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class FederationConfig(BaseModel):
    enabled: bool
    node_id: str | None = None


@app.post("/api/deployment/federation")
async def configure_federation(body: FederationConfig):
    """Enable or disable federation."""
    if body.enabled:
        return enable_federation(WORKSPACE, body.node_id)
    else:
        return disable_federation(WORKSPACE)


@app.post("/api/feature-requests")
async def create_feature_request(body: FeatureRequestCreate):
    title = body.title.strip()
    details = body.details.strip()
    if len(title) < 3:
        raise HTTPException(status_code=400, detail="title must be at least 3 characters")

    item = {
        "id": uuid.uuid4().hex,
        "title": title,
        "details": details,
        "status": "open",
        "votes": 0,
        "created_at": _now(),
    }

    items = _load_feature_requests()
    items.insert(0, item)
    _save_feature_requests(items)
    return item


@app.post("/api/feature-requests/{request_id}/vote")
async def vote_feature_request(request_id: str):
    items = _load_feature_requests()
    item = _find_feature_request(items, request_id)
    if not item:
        raise HTTPException(status_code=404, detail="feature request not found")

    item["votes"] = int(item.get("votes", 0)) + 1
    _save_feature_requests(items)
    return item


@app.post("/api/chat")
async def chat(body: ChatRequest):
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")
    if body.search:
        search_results = search_files_api(WORKSPACE, body.search, "")
        augmented = body.messages + [
            ChatMessage(
                role="assistant",
                content="Workspace search context:\n" + str(search_results),
            )
        ]
    else:
        augmented = body.messages

    sessions = _load_sessions()
    session_id = body.session_id or sessions.get("active_session_id")

    return StreamingResponse(
        run_agent_stream(
            [m.model_dump() for m in augmented],
            WORKSPACE,
            session_id=session_id,
            model_id=body.model_id,
            persona_id=body.persona_id,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/personas")
async def get_personas():
    data = list_personas(WORKSPACE)
    active = get_active_persona(WORKSPACE)
    return {
        "active_persona_id": data.get("active_persona_id"),
        "active": active,
        "items": data.get("items", []),
    }


@app.get("/api/personas/{persona_id}")
async def get_persona_details(persona_id: str):
    persona = get_persona(WORKSPACE, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="persona not found")
    return persona


@app.post("/api/personas")
async def create_persona_item(body: PersonaCreate):
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="name must be at least 2 characters")
    if len(body.system_prompt.strip()) < 10:
        raise HTTPException(status_code=400, detail="system_prompt must be at least 10 characters")
    return create_persona(WORKSPACE, body.name, body.description, body.system_prompt)


@app.put("/api/personas/{persona_id}")
async def update_persona_item(persona_id: str, body: PersonaUpdate):
    try:
        return update_persona(WORKSPACE, persona_id, body.name, body.description, body.system_prompt)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/api/personas/{persona_id}")
async def delete_persona_item(persona_id: str):
    try:
        delete_persona(WORKSPACE, persona_id)
        return {"status": "deleted", "persona_id": persona_id}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/personas/{persona_id}/activate")
async def activate_persona_item(persona_id: str):
    try:
        data = set_active_persona(WORKSPACE, persona_id)
        active = get_active_persona(WORKSPACE)
        return {
            "status": "ok",
            "active_persona_id": data.get("active_persona_id"),
            "active": active,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/files")
async def get_files(path: str = ""):
    return list_files_api(WORKSPACE, path)


@app.get("/api/files/read")
async def read_file(path: str):
    return read_file_api(WORKSPACE, path)


@app.post("/api/files/write")
async def write_file(body: FileWriteRequest):
    result = write_file_api(WORKSPACE, body.path, body.content)
    # Update search index
    try:
        filepath = os.path.join(WORKSPACE, body.path)
        SEARCH_INDEXER.index_file(filepath, body.content)
    except Exception:
        pass  # Index update failure shouldn't block file write
    return result


@app.delete("/api/files")
async def delete_file(path: str):
    result = delete_file_api(WORKSPACE, path)
    # Update search index
    try:
        filepath = os.path.join(WORKSPACE, path)
        SEARCH_INDEXER.remove_file(filepath)
    except Exception:
        pass  # Index update failure shouldn't block file delete
    return result


MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


@app.post("/api/files/upload")
async def upload_file(path: str = Form(""), file: UploadFile = File(...)):
    """Upload a file into the workspace at the given directory path."""
    filename = os.path.basename(file.filename or "")
    if not filename:
        raise HTTPException(status_code=400, detail="filename required")
    # Reject traversal attempts hidden in the filename itself
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="invalid filename")

    dest_dir = _safe(WORKSPACE, path if path else "")
    if not os.path.isdir(dest_dir):
        raise HTTPException(status_code=400, detail="destination path is not a directory")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file exceeds 50 MB limit")

    dest_path = os.path.join(dest_dir, filename)
    with open(dest_path, "wb") as fh:
        fh.write(content)

    rel_path = os.path.relpath(dest_path, WORKSPACE).replace(os.sep, "/")
    # Best-effort text indexing
    try:
        SEARCH_INDEXER.index_file(dest_path, content.decode("utf-8"))
    except Exception:
        pass

    append_action(WORKSPACE, {
        "event_type": "file_upload",
        "result_preview": rel_path,
    })
    return {"path": rel_path, "size": len(content), "filename": filename}


@app.get("/api/files/download")
async def download_file(path: str):
    """Download a single file from the workspace."""
    full_path = _safe(WORKSPACE, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="file not found")
    if os.path.isdir(full_path):
        raise HTTPException(status_code=400, detail="cannot download a directory")
    return FileResponse(
        full_path,
        filename=os.path.basename(full_path),
        media_type="application/octet-stream",
    )


@app.get("/api/search")
async def search_files(q: str, limit: int = 20):
    """Full-text search across workspace files."""
    if not q or len(q.strip()) < 2:
        return {"results": [], "query": q}
    
    results = SEARCH_INDEXER.search(q, limit)
    return {"results": results, "query": q, "count": len(results)}


@app.post("/api/search/rebuild")
async def rebuild_search_index():
    """Rebuild search index from scratch."""
    SEARCH_INDEXER.rebuild_from_workspace()
    return {"status": "index rebuilt", "info": SEARCH_INDEXER.get_status()}


@app.get("/api/search/status")
async def get_search_status():
    """Get search index status."""
    return SEARCH_INDEXER.get_status()


@app.get("/api/models")
async def get_models():
    """Get list of available models with capabilities."""
    models = list_models()
    return {
        "models": [model.to_dict() for model in models],
        "default": get_default_model().id,
    }


@app.get("/api/models/{model_id}")
async def get_model_details(model_id: str):
    """Get details about a specific model."""
    model = get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    return model.to_dict()


@app.get("/api/automation/jobs")
async def get_automation_jobs():
    data = load_jobs(WORKSPACE)
    return {"items": data.get("items", [])}


@app.post("/api/automation/jobs")
async def create_automation_job(body: AutomationJobCreate):
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="name must be at least 2 characters")
    if len(body.command.strip()) < 1:
        raise HTTPException(status_code=400, detail="command cannot be empty")
    item = create_job(
        WORKSPACE,
        name=body.name,
        command=body.command,
        interval_seconds=body.interval_seconds,
        enabled=body.enabled,
    )
    return item


@app.post("/api/automation/jobs/{job_id}")
async def update_automation_job(job_id: str, body: AutomationJobUpdate):
    try:
        return update_job(
            WORKSPACE,
            job_id,
            name=body.name,
            command=body.command,
            interval_seconds=body.interval_seconds,
            enabled=body.enabled,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/api/automation/jobs/{job_id}")
async def delete_automation_job(job_id: str):
    try:
        delete_job(WORKSPACE, job_id)
        return {"status": "deleted", "job_id": job_id}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/automation/jobs/{job_id}/run")
async def run_automation_job_now(job_id: str):
    try:
        return AUTOMATION.run_now(job_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/automation/logs")
async def get_automation_logs(limit: int = 100):
    return {"items": list_logs(WORKSPACE, limit=limit)}


@app.get("/api/services")
async def get_hosted_services():
    data = SERVICES.refresh()
    return {"items": data.get("items", [])}


@app.post("/api/services")
async def create_hosted_service(body: HostedServiceCreate):
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="name must be at least 2 characters")
    if len(body.command.strip()) < 1:
        raise HTTPException(status_code=400, detail="command cannot be empty")
    item = create_service(
        WORKSPACE,
        name=body.name,
        command=body.command,
        port=body.port,
        cwd=body.cwd,
        autostart=body.autostart,
        probe_path=body.probe_path,
        expected_status=body.expected_status,
        probe_interval_seconds=body.probe_interval_seconds,
        probe_timeout_seconds=body.probe_timeout_seconds,
    )
    return item


@app.post("/api/services/{service_id}")
async def update_hosted_service(service_id: str, body: HostedServiceUpdate):
    try:
        return update_service(
            WORKSPACE,
            service_id,
            name=body.name,
            command=body.command,
            port=body.port,
            cwd=body.cwd,
            autostart=body.autostart,
            probe_path=body.probe_path,
            expected_status=body.expected_status,
            probe_interval_seconds=body.probe_interval_seconds,
            probe_timeout_seconds=body.probe_timeout_seconds,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/api/services/{service_id}")
async def delete_hosted_service(service_id: str):
    try:
        delete_service(WORKSPACE, service_id)
        return {"status": "deleted", "service_id": service_id}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/services/{service_id}/start")
async def start_hosted_service(service_id: str):
    try:
        return SERVICES.start(service_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/services/{service_id}/stop")
async def stop_hosted_service(service_id: str):
    try:
        return SERVICES.stop(service_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/services/{service_id}/restart")
async def restart_hosted_service(service_id: str):
    try:
        return SERVICES.restart(service_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/services/{service_id}/logs")
async def get_hosted_service_logs(service_id: str, lines: int = 120):
    rows = read_service_logs(WORKSPACE, service_id, lines=lines)
    return {"service_id": service_id, "lines": rows}


# ── Cloud node contract endpoints (must register before static mount) ─────────

def _base_url(request: Request) -> str:
    fwd_proto = request.headers.get("x-forwarded-proto", "")
    fwd_host = request.headers.get("x-forwarded-host", "")
    if fwd_proto and fwd_host:
        return f"{fwd_proto}://{fwd_host}"
    host = request.headers.get("host", "")
    scheme = "https" if (fwd_proto == "https" or "443" in host) else "http"
    return f"{scheme}://{host}" if host else ""


def _verify_hub_callback_signature(request: Request, body_bytes: bytes) -> None:
    ts_header = request.headers.get("x-nexus-ts", "").strip()
    sig_header = request.headers.get("x-nexus-signature", "").strip()
    if not ts_header or not sig_header:
        raise HTTPException(status_code=401, detail="missing hub callback signature")
    try:
        ts = int(ts_header)
    except ValueError:
        raise HTTPException(status_code=401, detail="invalid hub callback timestamp")
    now = int(time.time())
    if abs(now - ts) > 300:
        raise HTTPException(status_code=401, detail="expired hub callback signature")

    canonical = b"\n".join([
        request.method.encode("utf-8"),
        request.url.path.encode("utf-8"),
        ts_header.encode("utf-8"),
        body_bytes,
    ])
    secret = get_node_secret(WORKSPACE).encode("utf-8")
    expected = hmac.new(secret, canonical, hashlib.sha256).hexdigest()
    provided = sig_header.split("=", 1)[-1].lower()
    if not hmac.compare_digest(expected, provided):
        raise HTTPException(status_code=401, detail="invalid hub callback signature")


@app.get("/.well-known/nexus-cloud", include_in_schema=True)
async def well_known_nexus_cloud(request: Request):
    """Nexus Cloud discovery document for hub registration and peer discovery."""
    return get_well_known(WORKSPACE, base_url=_base_url(request))


@app.get("/api/cloud/discovery")
async def cloud_discovery(request: Request):
    """Full runtime discovery document with live counters and current registrations."""
    service_items = SERVICES.refresh().get("items", [])
    running = sum(1 for s in service_items if s.get("status") == "running")
    unhealthy = sum(
        1 for s in service_items
        if s.get("status") == "running" and s.get("probe_healthy") is False
    )
    runtime = {
        "uptime_seconds": int(time.time() - START_TIME),
        "service_count": len(service_items),
        "running_services": running,
        "unhealthy_services": unhealthy,
        "platform": platform.platform(),
        "python": platform.python_version(),
    }
    return get_discovery(WORKSPACE, base_url=_base_url(request), runtime=runtime)


@app.post("/api/cloud/register")
async def cloud_register_endpoint(body: CloudRegistrationRequest, request: Request):
    """
    Nexusclaw registration endpoint.
    A hub POSTs here to register/link with this node.  We store a SHA-256
    hash of the node_token — the raw token is never persisted.
    """
    _verify_hub_callback_signature(request, await request.body())
    try:
        entry = register_hub(
            WORKSPACE,
            hub_id=body.hub_id,
            hub_url=body.hub_url,
            node_token=body.node_token,
            label=body.label,
            rotated_by="hub_callback",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    append_action(WORKSPACE, {
        "event_type": "cloud_register",
        "tool_name": "cloud_register",
        "hub_id": body.hub_id,
        "hub_url": body.hub_url,
        "label": body.label,
        "result_status": "ok",
        "rotated_by": "hub_callback",
        "result_preview": f"registered {body.hub_id} -> {body.hub_url}",
    })
    return {
        "status": "registered",
        "registration": entry,
        "node": get_well_known(WORKSPACE, base_url=_base_url(request)),
    }


@app.post("/api/cloud/registrations/manual")
async def cloud_register_manual_endpoint(body: CloudManualRegistrationRequest, request: Request):
    """Local operator endpoint for manual hub registration from the Nexus UI."""
    try:
        entry = register_hub(
            WORKSPACE,
            hub_id=body.hub_id,
            hub_url=body.hub_url,
            node_token=body.node_token,
            label=body.label,
            rotated_by=body.rotated_by,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    append_action(WORKSPACE, {
        "event_type": "cloud_register",
        "tool_name": "cloud_register_manual",
        "hub_id": body.hub_id,
        "hub_url": body.hub_url,
        "label": body.label,
        "result_status": "ok",
        "rotated_by": body.rotated_by,
        "result_preview": f"registered {body.hub_id} -> {body.hub_url}",
    })
    return {
        "status": "registered",
        "registration": entry,
        "node": get_well_known(WORKSPACE, base_url=_base_url(request)),
    }


@app.post("/api/cloud/register/rotate")
async def cloud_rotate_register_endpoint(body: CloudTokenRotateByHubRequest, request: Request):
    """Compatibility endpoint for hubs rotating an existing registration token."""
    _verify_hub_callback_signature(request, await request.body())
    try:
        entry = rotate_hub_token(WORKSPACE, body.hub_id, body.node_token, body.rotated_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    append_action(WORKSPACE, {
        "event_type": "cloud_token_rotate",
        "tool_name": "cloud_token_rotate",
        "hub_id": body.hub_id,
        "result_status": "ok",
        "rotated_by": body.rotated_by,
        "result_preview": f"rotated token for {body.hub_id}",
    })
    return {"status": "rotated", "registration": entry}


@app.get("/api/cloud/registrations")
async def cloud_list_registrations():
    """List all hub registrations for this node."""
    return {"items": list_registrations(WORKSPACE)}


@app.delete("/api/cloud/registrations/{hub_id}")
async def cloud_deregister_endpoint(hub_id: str):
    """Remove a hub registration from this node."""
    try:
        deregister_hub(WORKSPACE, hub_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    append_action(WORKSPACE, {
        "event_type": "cloud_deregister",
        "tool_name": "cloud_deregister",
        "hub_id": hub_id,
        "result_status": "ok",
        "result_preview": f"deregistered {hub_id}",
    })
    return {"status": "deregistered", "hub_id": hub_id}


@app.post("/api/cloud/registrations/{hub_id}/rotate")
async def cloud_rotate_token(hub_id: str, body: CloudTokenRotateRequest):
    """Rotate the node_token hash stored for an existing hub registration."""
    try:
        entry = rotate_hub_token(WORKSPACE, hub_id, body.node_token, body.rotated_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    append_action(WORKSPACE, {
        "event_type": "cloud_token_rotate",
        "tool_name": "cloud_token_rotate",
        "hub_id": hub_id,
        "result_status": "ok",
        "rotated_by": body.rotated_by,
        "result_preview": f"rotated token for {hub_id}",
    })
    return {"status": "rotated", "registration": entry}


# Serve built frontend — must be last; catch-all mount shadows everything after it
for _dir in ["/app/frontend/dist", "frontend/dist", "../frontend/dist"]:
    if os.path.exists(_dir):
        app.mount("/", StaticFiles(directory=_dir, html=True), name="static")
        break
