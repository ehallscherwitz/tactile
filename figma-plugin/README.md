# Figma Plugin: HACKAI Live Card Sync

This plugin connects directly to your backend websocket and applies incoming card patches to Figma in realtime.

## Load into Figma Desktop

1. Open Figma desktop app.
2. Go to `Plugins` -> `Development` -> `Import plugin from manifest...`.
3. Select `figma-plugin/manifest.json` from this repo.
4. Run plugin: `Plugins` -> `Development` -> `HACKAI Live Card Sync`.

## Connect to backend

1. Start backend with your env:
   - `python -m uvicorn app.main:app --reload --app-dir backend --env-file backend/.env`
2. In plugin UI:
   - WebSocket URL: `ws://127.0.0.1:8000/api/v1/ws/plugin/default`
   - Project ID: `default`
3. Click `Connect`.

## End-to-end test

1. Init card:
   - `POST /api/v1/cards/init` with `project_id=default`, `card_id=card-1`
2. Apply gesture:
   - `POST /api/v1/gestures/apply` with same ids
3. Plugin receives patch, updates selected card (or auto-creates one), and sends ack.

## Behavior notes

- If a node is selected when first patch arrives, plugin binds to that selected node for the card.
- If no node is selected, plugin auto-creates a card frame at viewport center.
- Node mapping is saved in plugin client storage by `project_id::card_id`.
- Plugin sends a websocket `hello` message with current `file_key`, `page_id`, and selected `node_id`.
- Backend session context can be read at `GET /api/v1/plugin/sessions/{project_id}`.
- Plugin can send full current page JSON via `Sync Page JSON` button (also auto-sent on connect).
- Backend snapshot endpoint: `GET /api/v1/plugin/snapshots/{project_id}/latest`.
