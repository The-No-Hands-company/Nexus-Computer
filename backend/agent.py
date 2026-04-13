import anthropic
import httpx
import json
import os
import subprocess
import time
import uuid
from typing import AsyncGenerator
from datetime import datetime, timezone

from action_ledger import append_action
from policy import load_policy, policy_decision, is_destructive_command
from tools import list_files_api, read_file_api, write_file_api
from model_registry import get_model, get_default_model
from personas import get_active_persona, get_persona

# ── AI engine selection ────────────────────────────────────────────────────────
# By default Nexus Computer uses the Anthropic SDK directly.
# Set NEXUS_AI_URL (e.g. http://localhost:7866) to route through Nexus AI — the
# sovereign NS AI engine — instead. ANTHROPIC_API_KEY takes priority if present.

_NEXUS_AI_URL = os.environ.get("NEXUS_AI_URL", "http://localhost:7866").rstrip("/")
_ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")

if _ANTHROPIC_KEY:
    client = anthropic.Anthropic(api_key=_ANTHROPIC_KEY)
else:
    client = None  # will use Nexus AI path

MODEL = os.environ.get("NEXUS_MODEL", "nexus-ai")

SYSTEM_PROMPT = """You are Nexus, a privacy-first personal cloud computer for The No Hands Company.

Core values:
- Free as in freedom and free as in price
- No paywalls, subscriptions, ads, tracking, or dark patterns
- Privacy first by default
- Build polished, durable, production-grade software
- Prefer clear, honest, concise communication

Operating rules:
- You have full access to the user's workspace.
- Use the available tools to inspect, modify, and run code.
- Before making risky or destructive changes, explain the plan briefly.
- Favor small, reliable steps over large speculative ones.
- If a task can be verified, verify it.
- Keep responses direct and practical.

You are helping build a production-ready personal cloud computer that feels calm, powerful, and trustworthy."""

TOOLS = [
    {
        "name": "bash",
        "description": "Execute a bash command in the workspace. Use for running scripts, installing packages, creating/moving files, managing processes, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Bash command to execute",
                }
            },
            "required": ["command"],
        },
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file in the workspace",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path relative to workspace",
                }
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write content to a file, creating directories as needed",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path relative to workspace"},
                "content": {"type": "string", "description": "Content to write"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "list_files",
        "description": "List files and directories at a path in the workspace",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory path relative to workspace (empty for root)",
                    "default": "",
                }
            },
        },
    },
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _result_status(result: str) -> str:
    text = (result or "").lower()
    if text.startswith("[error]") or text.startswith("[timeout]"):
        return "error"
    return "ok"


def _execute_tool(name: str, inp: dict, workspace: str) -> str:
    if name == "bash":
        policy = load_policy(workspace)
        decision = policy_decision(policy, "bash_destructive")
        command = inp.get("command", "")
        if is_destructive_command(command) and decision in {"confirm", "deny"}:
            return f"[error] policy blocked destructive bash command ({decision})"
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=60,
                cwd=workspace,
            )
            out = result.stdout
            if result.stderr:
                out += f"\n[stderr] {result.stderr}"
            if result.returncode != 0:
                out += f"\n[exit {result.returncode}]"
            return out.strip() or "(no output)"
        except subprocess.TimeoutExpired:
            return "[timeout] Command exceeded 60 seconds"
        except Exception as e:
            return f"[error] {e}"

    elif name == "read_file":
        try:
            data = read_file_api(workspace, inp["path"])
            return data.get("content", "")
        except Exception as e:
            return f"[error] {e}"

    elif name == "write_file":
        try:
            data = write_file_api(workspace, inp["path"], inp["content"])
            return f"Written: {data.get('path', inp['path'])}"
        except Exception as e:
            return f"[error] {e}"

    elif name == "list_files":
        try:
            data = list_files_api(workspace, inp.get("path", ""))
            return json.dumps(data.get("items", []), ensure_ascii=False)
        except Exception as e:
            return f"[error] {e}"

    return f"[error] Unknown tool: {name}"


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _nexus_ai_stream(messages: list):
    """Stream via Nexus AI engine when Anthropic key is absent.

    Nexus AI handles tool execution internally — Nexus Computer acts as a
    thin client.  SSE events coming from Nexus AI are mapped to the same
    format the Nexus Computer frontend expects.
    """
    # Last user message becomes the task; prior turns are sent as history.
    turns = [{"role": m["role"], "content": m["content"]} for m in messages]
    history = turns[:-1]
    task = turns[-1]["content"] if turns else ""

    url = f"{_NEXUS_AI_URL}/agent/stream"
    payload = json.dumps({"task": task, "session_id": None, "files": []})

    intro = f"[Nexus AI engine — {_NEXUS_AI_URL}]\n"
    yield _sse({"type": "text", "content": intro})

    try:
        async with httpx.AsyncClient(timeout=120.0) as http:
            async with http.stream("POST", url,
                                   content=payload,
                                   headers={"Content-Type": "application/json"}) as resp:
                resp.raise_for_status()
                async for raw_line in resp.aiter_lines():
                    if not raw_line.startswith("data:"):
                        continue
                    data_str = raw_line[5:].strip()
                    if not data_str:
                        continue
                    try:
                        evt = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    etype = evt.get("type", "")
                    if etype == "done":
                        content = evt.get("content", "")
                        if content:
                            yield _sse({"type": "text", "content": content})
                        yield _sse({"type": "done"})
                        return
                    elif etype == "think":
                        thought = evt.get("thought", "")
                        if thought:
                            yield _sse({"type": "text", "content": f"💭 {thought}\n"})
                    elif etype == "tool":
                        action = evt.get("action", "tool")
                        icon = evt.get("icon", "🔧")
                        result = evt.get("result", "")
                        yield _sse({"type": "tool_use", "name": action,
                                    "input": {"action": action, "result": result, "icon": icon}})
                    elif etype == "error":
                        yield _sse({"type": "text", "content": f"❌ {evt.get('message', 'Error')}\n"})
                        yield _sse({"type": "done"})
                        return
    except Exception as e:
        yield _sse({"type": "text", "content": f"❌ Nexus AI connection failed: {e}\n"})
        yield _sse({"type": "done"})


def _compose_system_prompt(persona: dict | None) -> str:
    if not persona:
        return SYSTEM_PROMPT
    persona_name = persona.get("name", "Persona")
    persona_prompt = (persona.get("system_prompt") or "").strip()
    if not persona_prompt:
        return SYSTEM_PROMPT
    return f"{SYSTEM_PROMPT}\n\nActive persona: {persona_name}\nPersona instructions:\n{persona_prompt}"


async def run_agent_stream(
    messages: list,
    workspace: str,
    session_id: str | None = None,
    model_id: str | None = None,
    persona_id: str | None = None,
):
    """Agentic loop with SSE streaming.

    Args:
        messages: Conversation history
        workspace: Workspace directory
        session_id: Session ID for action logging
        model_id: Model to use (defaults to "nexus-ai")
    
    Routes through selected model with intelligent fallback.
    """
    # Select model
    model = None
    if model_id:
        model = get_model(model_id)
        if not model:
            yield _sse({"type": "text", "content": f"❌ Model {model_id} not found.\n"})
            yield _sse({"type": "done"})
            return
    else:
        model = get_default_model()

    selected_persona = None
    if persona_id:
        selected_persona = get_persona(workspace, persona_id)
    if not selected_persona:
        selected_persona = get_active_persona(workspace)
    persona_system = _compose_system_prompt(selected_persona)
    
    # ── Nexus AI path ──────────────────────────────────────────────────────
    if model.provider == "nexus-ai":
        # Nexus AI endpoint does not currently support a separate system field,
        # so persona directives are prepended to the latest user turn.
        if messages:
            adjusted = list(messages)
            last = dict(adjusted[-1])
            last_content = last.get("content", "")
            last["content"] = (
                f"[Persona: {selected_persona.get('name', 'Default')}]\n"
                f"{selected_persona.get('system_prompt', '')}\n\n"
                f"User request:\n{last_content}"
            )
            adjusted[-1] = last
            messages = adjusted
        async for chunk in _nexus_ai_stream(messages):
            yield chunk
        return

    # ── Anthropic path ─────────────────────────────────────────────────────
    if model.provider == "anthropic":
        try:
            anthropic_client = anthropic.Anthropic(api_key=model.config.get("api_key"))
        except Exception as e:
            yield _sse({"type": "text", "content": f"❌ Failed to initialize {model.name}: {e}\n"})
            yield _sse({"type": "done"})
            return
    else:
        yield _sse({"type": "text", "content": f"❌ Provider {model.provider} not supported.\n"})
        yield _sse({"type": "done"})
        return

    # ── Stream from model ──────────────────────────────────────────────────
    anthropic_messages = [{"role": m["role"], "content": m["content"]} for m in messages]
    run_id = uuid.uuid4().hex
    prompt_preview = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            prompt_preview = (m.get("content") or "")[:300]
            break

    while True:
        collected_text = ""
        final_content = []

        with anthropic_client.messages.stream(
            model=model.config.get("model_name"),
            max_tokens=4096,
            system=persona_system,
            tools=TOOLS,
            messages=anthropic_messages,
        ) as stream:
            for event in stream:
                t = getattr(event, "type", None)
                if t == "content_block_delta":
                    delta = getattr(event, "delta", None)
                    if delta and hasattr(delta, "text"):
                        collected_text += delta.text
                        yield _sse({"type": "text", "content": delta.text})

            msg = stream.get_final_message()
            final_content = msg.content
            stop_reason = msg.stop_reason

        tool_uses = [b for b in final_content if b.type == "tool_use"]

        if stop_reason == "end_turn" or not tool_uses:
            yield _sse({"type": "done"})
            break

        if stop_reason == "tool_use":
            assistant_blocks = []
            if collected_text:
                assistant_blocks.append({"type": "text", "text": collected_text})
            for tu in tool_uses:
                assistant_blocks.append(
                    {"type": "tool_use", "id": tu.id, "name": tu.name, "input": tu.input}
                )
            anthropic_messages.append({"role": "assistant", "content": assistant_blocks})

            tool_results = []
            for tu in tool_uses:
                append_action(
                    workspace,
                    {
                        "event_type": "tool_use",
                        "run_id": run_id,
                        "session_id": session_id,
                        "model": model.id,
                        "persona_id": selected_persona.get("id") if selected_persona else None,
                        "tool_name": tu.name,
                        "tool_input": tu.input,
                        "prompt_preview": prompt_preview,
                        "created_at": _now(),
                    },
                )

                yield _sse({"type": "tool_use", "name": tu.name, "input": tu.input})
                started = time.time()
                result = _execute_tool(tu.name, tu.input, workspace)
                duration_ms = int((time.time() - started) * 1000)

                append_action(
                    workspace,
                    {
                        "event_type": "tool_result",
                        "run_id": run_id,
                        "session_id": session_id,
                        "model": model.id,
                        "persona_id": selected_persona.get("id") if selected_persona else None,
                        "tool_name": tu.name,
                        "result_status": _result_status(result),
                        "result_preview": result[:5000],
                        "duration_ms": duration_ms,
                        "created_at": _now(),
                    },
                )

                yield _sse({"type": "tool_result", "name": tu.name, "result": result[:1000]})
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": tu.id, "content": result}
                )

            anthropic_messages.append({"role": "user", "content": tool_results})
            continue

        yield _sse({"type": "done"})
        break
