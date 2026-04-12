# Nexus.computer

Nexus Computer is a privacy-first personal cloud computer for The No Hands Company.
It is built to feel like a calm, powerful, production-grade alternative to the Zo computer experience:
free as in freedom, open source, private by default, and never paywalled.

## What it does

- Chat with an AI agent that can run shell commands
- Create, read, write, and delete files in a persistent workspace
- Build tools, scripts, and services inside your own cloud computer
- Stream results live in a terminal-style interface

## Philosophy

- No subscriptions
- No ads
- No tracking
- No paywalls
- No surveillance
- Free software, forever
- Private by default

## Stack

- Backend: FastAPI + Anthropic SDK
- Frontend: React + Vite
- Deployment: Railway-ready single service

## Production features

- Streaming agent chat
- Workspace file explorer
- Safe workspace path handling
- Security headers
- Health and metadata endpoints
- Persistent workspace volume support

## Run locally

```bash
cd backend
pip install -r requirements.txt
ANTHROPIC_API_KEY=your_key uvicorn main:app --reload
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

## Build for deployment

```bash
cd frontend
npm run build
```

Then run the Python app with the built frontend available under `frontend/dist`.

## Environment variables

- `ANTHROPIC_API_KEY` — required for the agent
- `NEXUS_MODEL` — optional model override
- `WORKSPACE_DIR` — optional workspace path, defaults to `/workspace`
- `CORS_ORIGINS` — optional comma-separated allowed origins

## Project layout

- `backend/main.py` — API entrypoint
- `backend/agent.py` — agent loop and tool use
- `backend/tools.py` — workspace file helpers
- `frontend/src/` — UI

## License

Add the license you want to ship with before public release.
