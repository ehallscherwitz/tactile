# HACKAI-figma

Backend-first project for hand-signal-driven card updates in Figma.

## Step 1: FastAPI foundation (no API keys required)

1. Create and activate a Python virtual environment.
   - `python -m venv .venv`
   - PowerShell: `.\.venv\Scripts\Activate.ps1`
2. Install dependencies:
   - `python -m pip install -r backend/requirements.txt`
3. Start the backend:
   - `python -m uvicorn app.main:app --reload --app-dir backend`
4. Verify health:
   - `GET http://127.0.0.1:8000/api/v1/health`

## Step 2: Validate gesture contracts (still no API keys)

Test the deterministic gesture simulation endpoint:

- `POST http://127.0.0.1:8000/api/v1/gestures/simulate`

Example body:

```json
{
  "current_state": {
    "card_id": "card-1",
    "version": 1,
    "width": 320,
    "height": 200,
    "color_scheme": "light",
    "liquid_glass": false
  },
  "event": {
    "event_id": "evt-1",
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
   - `GET http://127.0.0.1:8000/api/v1/cards/{card_id}`

If `MONGODB_URI` is not set, persistence routes return `503` with a setup message.