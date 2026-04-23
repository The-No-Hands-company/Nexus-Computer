"""
Nexus Computer — AI agent layer.

Routes all inference through Nexus AI (OpenAI-compatible /v1/chat/completions).
Tools (bash, read_file, write_file, list_files) execute locally in the workspace.
Nexus AI is the SOLE AI provider — no external API keys required.
"""

import httpx
import json
import os
import subprocess
import time
import uuid
from datetime import datetime, timezone

from action_ledger import append_action
from policy import load_policy, policy_decision, is_destructive_command
from tools import list_files_api, read_file_api, write_file_api
from model_registry import get_model, get_default_model
from personas import get_active_persona, get_persona

# ── Nexus AI connection ────────────────────────────────────────────────────────
NEXUS_AI_URL = os.environ.get("NEXUS_AI_URL", "http://localhost:7866").rstrip("/")
NEXUS_AI_TIMEOUT = float(os.environ.get("NEXUS_AI_TIMEOUT", "120"))

SYSTEM_PROMPT = """You are Nexus, a privacy-first personal cloud computer for The No Hands Company.

Core values:
- Free as in freedom and free as in price
- No paywalls, subscriptions, ads, tracking, or dark patterns
- Privacy first by default
- Build polished, durable, production-grade software
- Prefer clear, honest, concise communication

Operating rules:
- You have full access to the user's workspace via tools.
- Use bash, read_file, write_file, and list_files to act on the workspace.
- Before making risky or destructive changes, explain the plan briefly.
- Favor small, reliable steps over large speculative ones.
- If a task can be verified, verify it.
- Keep responses direct and practical.

You are powered by Nexus AI — the sovereign, self-hosted intelligence layer of the Nexus ecosystem."""

# OpenAI-compatible tool definitions
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": "Execute a bash command in the workspace. Use for running scripts, installing packages, creating/moving files, managing processes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Bash command to execute"}
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to workspace"}
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file, creating directories as needed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files and directories at a path in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "default": ""}
                },
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
    """Execute a tool locally in the workspace."""
    if name == "bash":
        policy = load_policy(workspace)
        decision = policy_decision(policy, "bash_destructive")
        command = inp.get("command", "")
        if is_destructive_command(command) and decision in {"confirm", "deny"}:
            return f"[error] policy blocked destructive bash command ({decision})"
        try:
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True,
                timeout=60, cwd=workspace,
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


def _build_system(persona: dict | None) -> str:
    if not persona:
        return SYSTEM_PROMPT
    persona_prompt = (persona.get("system_prompt") or "").strip()
    if not persona_prompt:
        return SYSTEM_PROMPT
    return f"{SYSTEM_PROMPT}\n\nActive persona — {persona.get('name', 'Custom')}:\n{persona_prompt}"


def _to_openai_messages(messages: list, system: str) -> list:
    """Convert message list to OpenAI format with system prefix."""
    result = [{"role": "system", "content": system}]
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role in ("user", "assistant"):
            result.append({"role": role, "content": content})
    return result


async def run_agent_stream(
    messages: list,
    workspace: str,
    session_id: str | None = None,
    model_id: str | None = None,
    persona_id: str | None = None,
):
    """
    Agentic loop — streams SSE events.

    All inference goes through Nexus AI (/v1/chat/completions).
    Tools execute locally in the workspace. Loop continues until
    Nexus AI returns a final text response with no tool calls.
    """
    # Resolve persona
    persona = None
    if persona_id:
        persona = get_persona(workspace, persona_id)
    if not persona:
        persona = get_active_persona(workspace)
    system = _build_system(persona)

    # Build OpenAI-format message list
    oai_messages = _to_openai_messages(messages, system)

    run_id = uuid.uuid4().hex
    prompt_preview = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            prompt_preview = (m.get("content") or "")[:300]
            break

    # Check Nexus AI reachability first
    try:
        async with httpx.AsyncClient(timeout=5.0) as probe:
            await probe.get(f"{NEXUS_AI_URL}/health")
    except Exception:
        yield _sse({
            "type": "error",
            "content": (
                f"⚠️  Nexus AI is not reachable at {NEXUS_AI_URL}.\n\n"
                "Make sure Nexus AI is running and set NEXUS_AI_URL correctly.\n"
                "Nexus.computer uses Nexus AI as its intelligence layer."
            ),
        })
        yield _sse({"type": "done"})
        return

    # ── Agentic loop ──────────────────────────────────────────────────────────
    iteration = 0
    max_iterations = 20  # safety cap

    while iteration < max_iterations:
        iteration += 1
        collected_text = ""

        try:
            async with httpx.AsyncClient(timeout=NEXUS_AI_TIMEOUT) as http:
                async with http.stream(
                    "POST",
                    f"{NEXUS_AI_URL}/v1/chat/completions",
                    json={
                        "messages": oai_messages,
                        "tools": TOOLS,
                        "tool_choice": "auto",
                        "stream": True,
                    },
                    headers={"Accept": "text/event-stream"},
                ) as resp:
                    resp.raise_for_status()

                    # Accumulate streamed chunks
                    tool_calls_raw = {}  # index → {id, name, arguments_str}

                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data_str = line[5:].strip()
                        if not data_str or data_str == "[DONE]":
                            continue

                        try:
                            chunk = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        choice = (chunk.get("choices") or [{}])[0]
                        delta = choice.get("delta", {})
                        finish = choice.get("finish_reason")

                        # Stream text
                        if delta.get("content"):
                            collected_text += delta["content"]
                            yield _sse({"type": "text", "content": delta["content"]})

                        # Accumulate tool call deltas
                        for tc in delta.get("tool_calls") or []:
                            idx = tc.get("index", 0)
                            if idx not in tool_calls_raw:
                                tool_calls_raw[idx] = {"id": "", "name": "", "arguments_str": ""}
                            if tc.get("id"):
                                tool_calls_raw[idx]["id"] = tc["id"]
                            fn = tc.get("function", {})
                            if fn.get("name"):
                                tool_calls_raw[idx]["name"] = fn["name"]
                            if fn.get("arguments"):
                                tool_calls_raw[idx]["arguments_str"] += fn["arguments"]

        except httpx.HTTPStatusError as e:
            yield _sse({"type": "error", "content": f"Nexus AI error {e.response.status_code}: {e.response.text[:200]}"})
            yield _sse({"type": "done"})
            return
        except Exception as e:
            yield _sse({"type": "error", "content": f"Nexus AI stream error: {e}"})
            yield _sse({"type": "done"})
            return

        # No tool calls → we're done
        if not tool_calls_raw:
            yield _sse({"type": "done"})
            return

        # ── Execute tool calls locally ────────────────────────────────────────
        # Add assistant message with tool calls to history
        assistant_msg: dict = {"role": "assistant", "content": collected_text or None, "tool_calls": []}
        tool_results_msgs = []

        for idx in sorted(tool_calls_raw.keys()):
            tc = tool_calls_raw[idx]
            call_id = tc["id"] or uuid.uuid4().hex
            name = tc["name"]
            try:
                inp = json.loads(tc["arguments_str"] or "{}")
            except json.JSONDecodeError:
                inp = {}

            assistant_msg["tool_calls"].append({
                "id": call_id,
                "type": "function",
                "function": {"name": name, "arguments": tc["arguments_str"]},
            })

            # Log intent
            append_action(workspace, {
                "event_type": "tool_use",
                "run_id": run_id,
                "session_id": session_id,
                "tool_name": name,
                "tool_input": inp,
                "prompt_preview": prompt_preview,
                "created_at": _now(),
            })
            yield _sse({"type": "tool_use", "name": name, "input": inp})

            # Execute locally
            started = time.time()
            result = _execute_tool(name, inp, workspace)
            duration_ms = int((time.time() - started) * 1000)

            append_action(workspace, {
                "event_type": "tool_result",
                "run_id": run_id,
                "session_id": session_id,
                "tool_name": name,
                "result_status": _result_status(result),
                "result_preview": result[:5000],
                "duration_ms": duration_ms,
                "created_at": _now(),
            })
            yield _sse({"type": "tool_result", "name": name, "result": result[:2000]})

            tool_results_msgs.append({
                "role": "tool",
                "tool_call_id": call_id,
                "content": result,
            })

        # Append assistant + tool results and loop
        oai_messages.append(assistant_msg)
        oai_messages.extend(tool_results_msgs)

    yield _sse({"type": "error", "content": "[max iterations reached]"})
    yield _sse({"type": "done"})
