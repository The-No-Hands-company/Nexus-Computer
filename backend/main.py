from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from typing import Literal
import json
import os
import platform
import shutil
import time
import uuid
from datetime import datetime, timezone

from agent import run_agent_stream
from tools import list_files_api, read_file_api, write_file_api, delete_file_api, search_files_api
from action_ledger import ensure_action_ledger, list_actions
from policy import ensure_policy, load_policy
from snapshots import create_snapshot, list_snapshots, restore_snapshot
from search import SearchIndexer
from model_registry import list_models, get_model, get_default_model
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
SEARCH_INDEXER = SearchIndexer(WORKSPACE)


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


@app.get("/api/health")
async def health():
    return {"status": "online", "workspace": WORKSPACE}


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


# Serve built frontend — checked at startup
for _dir in ["/app/frontend/dist", "frontend/dist", "../frontend/dist"]:
    if os.path.exists(_dir):
        app.mount("/", StaticFiles(directory=_dir, html=True), name="static")
        break
