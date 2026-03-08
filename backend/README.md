# HACKAI-figma

Backend-first project for hand-signal-driven card updates in Figma.

## Step 1: FastAPI foundation (no API keys required)

1. Create and activate a Python virtual environment.
   - `python -m venv .venv`
   - PowerShell: `.\.venv\Scripts\Activate.ps1`
2. Install dependencies:
   - `python -m pip install -r backend/requirements.txt`
3. Start the backend:
   - `python -m uvicorn app.main:app --reload --app-dir backend --env-file backend/.env`
4. Verify health:
   - `GET http://127.0.0.1:8000/api/v1/health`

## Step 2: Validate gesture contracts (still no API keys)

Test the deterministic gesture simulation endpoint:

- `POST http://127.0.0.1:8000/api/v1/gestures/simulate`

Example body:

```json
{
  "current_state": {
    "project_id": "default",
    "card_id": "card-1",
    "version": 1,
    "width": 320,
    "height": 200,
    "color_scheme": "light",
    "liquid_glass": false
  },
  "event": {
    "event_id": "evt-1",
    "project_id": "default",
    "card_id": "card-1",
    "sequence_id": "seq-1",
    "intent": "increase_size",
    "params": {
      "size_step": 24
    }
  }
}
```

## Step 3: Add Mongo persistence (no Figma/Gemini keys yet)

1. Add MongoDB connection in `backend/.env`:
   - `MONGODB_URI=mongodb://localhost:27017`
   - `MONGODB_DB_NAME=hackai`
2. Restart backend after setting env.
3. Initialize a card:
   - `POST http://127.0.0.1:8000/api/v1/cards/init`
4. Persist a gesture event:
   - `POST http://127.0.0.1:8000/api/v1/gestures/apply`
5. Fetch current card:
   - `GET http://127.0.0.1:8000/api/v1/cards/{card_id}?project_id=default`

If `MONGODB_URI` is not set, persistence routes return `503` with a setup message.

## Step 4: Plugin realtime sync (websocket + ack)

- Plugin websocket endpoint:
  - `ws://127.0.0.1:8000/api/v1/ws/plugin/{project_id}`
- Backend sends patches as:
  - `{"type":"card_patch","patch":{...}}`
- Plugin sends ack as:
  - `{"type":"ack","patch_id":"<patch-id>","status":"applied"}`
  - or `{"type":"ack","patch_id":"<patch-id>","status":"failed","error":"reason"}`
- Gesture apply route now persists patch delivery status and pushes live when plugin is connected.
- Reconnect behavior:
  - pending/failed patches replay automatically on websocket reconnect.

## Step 5: Figma plugin live apply

Use the plugin in `figma-plugin/` to connect Figma directly to backend websocket and apply live patches.

### Start tunnel (required for Figma plugin websocket)

**Option A — Cloudflared (recommended, no interstitial):**

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8000
```

**Option B — ngrok (has free-tier interstitial that blocks websocket):**

```powershell
python -c "from pyngrok import ngrok; t=ngrok.connect(8000, bind_tls=True); print(t.public_url); input('Press Enter to stop...')"
```

Note: each restart gives a new URL. Update the plugin websocket URL accordingly.

### Manifest

Remove `networkAccess` entirely for dev mode — this allows unrestricted connections:

```json
{
  "name": "hackai4",
  "id": "1612308177747938125",
  "api": "1.0.0",
  "main": "code.js",
  "capabilities": ["inspect"],
  "enableProposedApi": false,
  "documentAccess": "dynamic-page",
  "editorType": ["figma", "dev"],
  "ui": "ui.html"
}
```

### Quick flow

1. Import plugin manifest in Figma desktop:
   - `figma-plugin/manifest.json`
2. Run plugin and connect websocket:
   - Cloudflared: `wss://<cloudflared-domain>/api/v1/ws/plugin/default`
   - Localhost: `ws://localhost:8000/api/v1/ws/plugin/default`
3. Trigger backend update:
   - `POST /api/v1/gestures/apply` with `project_id=default`
4. Verify plugin logs:
   - receives `card_patch`
   - applies node update
   - sends `ack` back

Plugin now also sends `hello` context on connect/selection/page change:

- `{"type":"hello","project_id":"default","file_key":"...","page_id":"...","node_id":"..."}`

Backend stores latest plugin session context per project in Mongo:

- `GET /api/v1/plugin/sessions/{project_id}`

Plugin can now send full current page JSON snapshot over websocket:

- `{"type":"page_snapshot","project_id":"default","page_id":"...","page_json":{...}}`

Backend stores latest snapshot in Mongo:

- `GET /api/v1/plugin/snapshots/{project_id}/latest`

## Step 6: Deterministic baseline from snapshot (no LLM yet)

After plugin has synced page JSON, derive a `card_spec` from snapshot and initialize/update card defaults:

- `POST /api/v1/cards/bootstrap-from-snapshot`
  - body: `project_id`, `card_id`, `overwrite_existing_card` (optional)
- get extracted spec:
  - `GET /api/v1/cards/{card_id}/spec?project_id=default`

This gives a reliable non-LLM baseline (size, color scheme, font defaults) before adding LangChain/Gemini.

## Step 7: LangChain agent setup (Groq)

The backend now includes LangChain-powered AI routes under `/api/v1/ai` with
Groq as the default provider.

### Env setup

Add to `backend/.env`:

- `AUTO_ADAPT_ON_SNAPSHOT=false` (recommended; prevents unsolicited auto cards on sync)
- `LLM_PROVIDER=groq`
- `GROQ_API_KEY=<your-key>`
- `GROQ_MODEL=llama-3.3-70b-versatile` (or another Groq-supported chat model)

Optional fallback:

- `LLM_PROVIDER=google` (or `gemini`)
- `GOOGLE_API_KEY=<your-key>`

### AI routes

- `POST /api/v1/ai/adapt-frame`
  - Uses latest Figma snapshot + style extraction to create a contextual frame patch.
- `POST /api/v1/ai/generate-frame`
  - Prompt-driven frame patch generation.
- `POST /api/v1/ai/reconcile-frame`
  - Post-manipulation step: takes a `final_frame_state` JSON and generates a patch that
    maps edited state back into the original design language.
- `POST /api/v1/ai/frontend-card`
  - Returns a `patch` plus a frontend-renderable `frontend_card.html` snippet built from
    the same context (title/subtitle/fonts/colors).
  - Optional `dispatch_to_plugin=true` if you want to send the patch to Figma too.
- `POST /api/v1/ai/run`
  - One-call abstraction for testing with plugin: generate from latest context and dispatch.
  - Optional `prompt` for quality direction.
  - Optional `include_frontend_html=true` to also get frontend render HTML in response.

All routes persist a patch in MongoDB and dispatch it over plugin websocket (if connected).