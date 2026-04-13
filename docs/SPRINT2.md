# Nexus Computer Sprint 2: Core Features & User Control

**Sprint Goal**: Ship file search, multi-model routing, personas, and intelligent defaults. Enable Nexus Computer to compete directly with Zo on core capabilities while maintaining privacy-first architecture.

**Duration**: 2-week sprint  
**Target completion**: April 27, 2026

---

## Deliverables

### 1. Full-Text File Search
**Impact**: Immediate productivity win. Users can find their work.

**Backend**:
- Add search indexing to `backend/search.py` (new module)
  - Index files in workspace on startup and when files change
  - BM25 ranking algorithm for relevance
  - Search across file content and filenames
  - Respect `.nexusignore` exclusions
- Extend `backend/main.py` with:
  - `GET /api/search?q=query&limit=20` — Full-text search with pagination
  - `GET /api/search/index-status` — Show indexed file count, last update

**Frontend**:
- Update `frontend/src/components/FileExplorer.jsx`
  - Add search bar at top of panel
  - Display results as inline matches with context preview
  - Click to navigate to file in editor

**Completion criteria**:
- ✅ Search finds files by name and content
- ✅ Results ranked by relevance
- ✅ 100+ files searchable within 100ms
- ✅ Frontend displays top 20 results with preview

---

### 2. Multi-Model Support & Routing
**Impact**: Parity with Zo's "multiple leading AI models" capability. Unlock user choice.

**Backend**:
- Create `backend/model_registry.py` (new module)
  - Define available models with capabilities (chat, code, analysis, etc.)
  - Model availability and cost tracking
  - Fallback chain if primary unavailable
- Update `backend/agent.py`:
  - Accept `model` param in ChatRequest
  - Route to selected model with intelligent fallbacks
  - Track model usage in action ledger
- New endpoint in `backend/main.py`:
  - `GET /api/models` — List available models with capabilities
  - `POST /api/models/default` — Set default model

**Models to support**:
- `nexus-ai` (localhost:7866) — Primary, local
- `claude-opus-4` (Anthropic) — Fallback for complex tasks
- `claude-haiku` (Anthropic) — Fast, lightweight
- Optional: Open-source models via Ollama, Together API

**Frontend**:
- Add model selector to Chat component header
- Show model capabilities and response time stats
- Default to Nexus AI, allow per-conversation override

**Completion criteria**:
- ✅ Chat accepts model selection
- ✅ Graceful fallback if model unavailable
- ✅ Model preference persisted in session
- ✅ Usage stats tracked in action ledger

---

### 3. Personas & System Prompts
**Impact**: Core user control feature. Differentiator: users shape AI behavior.

**Backend**:
- Create `backend/personas.py` (new module)
  - Store personas as JSON with name, system_prompt, metadata
  - CRUD endpoints for persona management
  - Default personas: Developer, Writer, Analyst, Tutor
- Update `backend/agent.py`:
  - Apply selected persona's system prompt to all model calls
  - Include persona metadata in action ledger
- New endpoints in `backend/main.py`:
  - `GET /api/personas` — List all personas
  - `POST /api/personas` — Create new persona
  - `GET /api/personas/{id}` — Get persona details
  - `PUT /api/personas/{id}` — Update persona
  - `DELETE /api/personas/{id}` — Delete persona
  - `POST /api/personas/{id}/activate` — Set as default

**Default personas**:
```
Developer: "You are an expert software engineer..."
Writer: "You are a skilled technical writer..."
Analyst: "You are a data analyst..."
Tutor: "You are a patient educator..."
```

**Frontend**:
- New `PersonasPanel.jsx` component
  - List existing personas with edit/delete
  - Create new persona dialog with system prompt editor
  - Set default persona
  - Preview persona effect on chat
- Update Chat component:
  - Show active persona in header
  - Persona selector dropdown
  - Per-conversation persona override

**Completion criteria**:
- ✅ 4+ default personas deployed
- ✅ Can create/edit/delete custom personas
- ✅ Persona system prompt applied to all requests
- ✅ Frontend shows active persona, allows switching

---

### 4. Enhanced Session Management
**Impact**: Users can resume work, organize conversations.

**Backend**:
- Extend `backend/main.py` sessions:
  - Save session title, tags, model, persona
  - Session search by title/tags
  - Mark sessions as favorites or archived
- Track in action ledger: session metadata updates

**Frontend**:
- Update `SessionsPanel` (if exists) or create new:
  - List sessions with title edit
  - Tags for organization
  - Search/filter by tags
  - Archive/unarchive sessions
  - Copy session to new session (seed with context)

**Completion criteria**:
- ✅ Sessions have human-readable titles
- ✅ Can tag and organize sessions
- ✅ Can search sessions
- ✅ Session metadata synced with backend

---

## Technical Priorities

### Code Quality
- New modules: `search.py`, `model_registry.py`, `personas.py`
- All use same patterns: append-only logging, safe file I/O, policy enforcement
- No breaking changes to existing APIs

### Performance
- Search: < 100ms for typical queries
- Model routing: < 50ms decision overhead
- Personas: < 5ms system prompt injection

### Safety & Privacy
- All user data stays in workspace
- Search index is local, not sent anywhere
- Persona system prompts never leaked in responses
- Model routing respects policy (blocks certain models if needed)

---

## Success Metrics

1. **File Search**
   - 100% of workspace searchable
   - Top result relevant for 95%+ of queries
   - < 100ms response time

2. **Multi-Model**
   - Users can select any available model
   - Fallback to Nexus AI if selected model fails
   - Usage tracked accurately in action ledger

3. **Personas**
   - Users can create custom personas
   - Persona system prompt visibly affects AI responses
   - Smooth UX for persona switching

4. **Sessions**
   - All sessions have meaningful titles
   - Can organize with tags
   - Search surfaces correct sessions

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Search indexing slows startup | Lazy indexing: background worker builds index after startup |
| Multiple models → confusion | Default to Nexus AI, show clear selector, document each model's strengths |
| Persona system prompts conflict with safety | Personas validated against safety rules before saving |
| Session metadata bloat | Archive old sessions automatically after 90 days |

---

## Rollout Plan

**Week 1**:
- Mon-Tue: File search (search.py + Backend)
- Wed: File search (Frontend integration)
- Thu-Fri: Multi-model routing (model_registry.py + agent updates)

**Week 2**:
- Mon: Multi-model (Frontend + testing)
- Tue-Wed: Personas (personas.py + backend)
- Thu-Fri: Personas (Frontend) + Enhanced sessions

**Post-sprint**: Polish, bug fixes, performance tuning

---

## Acceptance Criteria

- All endpoints implemented and documented
- No new syntax errors
- Frontend components render without warnings
- Action ledger entries created for all operations
- Deployment config still functional
- No breaking changes to existing APIs
