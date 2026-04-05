from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
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


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    search: str | None = None


class FileWriteRequest(BaseModel):
    path: str
    content: str


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
        "model": os.environ.get("NEXUS_MODEL", "claude-sonnet-4-6"),
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


@app.get("/api/search")
async def search(q: str, path: str = ""):
    if not q.strip():
        raise HTTPException(status_code=400, detail="q cannot be empty")
    return search_files_api(WORKSPACE, q, path)


@app.get("/api/feature-requests")
async def list_feature_requests():
    items = _load_feature_requests()
    return {"items": _sorted_feature_requests(items)}


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
    return StreamingResponse(
        run_agent_stream([m.model_dump() for m in augmented], WORKSPACE),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/files")
async def get_files(path: str = ""):
    return list_files_api(WORKSPACE, path)


@app.get("/api/files/read")
async def read_file(path: str):
    return read_file_api(WORKSPACE, path)


@app.post("/api/files/write")
async def write_file(body: FileWriteRequest):
    return write_file_api(WORKSPACE, body.path, body.content)


@app.delete("/api/files")
async def delete_file(path: str):
    return delete_file_api(WORKSPACE, path)


# Serve built frontend — checked at startup
for _dir in ["/app/frontend/dist", "frontend/dist", "../frontend/dist"]:
    if os.path.exists(_dir):
        app.mount("/", StaticFiles(directory=_dir, html=True), name="static")
        break
