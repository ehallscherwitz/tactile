import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { classifyGesture } from './lib/gestures';
import { COMP_MAP, GESTURE_TO_COMP, SCHEMES } from './lib/components';

const HOLD_ACT = 22;
const CREATE_DBG = 5;
const CREATE_CD = 45;

const CONN = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const HUDS = {
  pinch:        { e: '👌', t: 'Pinching — drag to move' },
  create_index: { e: '☝️', t: 'Button — hold steady…' },
  create_peace: { e: '✌️', t: 'Card — hold steady…' },
  create_rock:  { e: '🤘', t: 'Input — hold steady…' },
  create_thumb: { e: '👍', t: 'Navbar — hold steady…' },
  fist:         { e: '✊', t: 'Hold to delete component' },
  point:        { e: '🔫', t: 'Hold to sync to Figma' },
  spread:       { e: '↔️', t: 'Spread — resizing card' },
  idle:         { e: '✋', t: 'Show your hands to begin' },
  ready:        { e: '✋', t: 'Make a gesture to create' },
  cool:         { e: '⏳', t: 'Ready for next gesture…' },
};

export function createEngine(refs, callbacks) {
  const {
    video, canvas, stage,
    cursor, ghost, ghostLabel, ghostBody,
    ring, ringArc,
  } = refs;

  const {
    onHudChange, onCardCountChange, onStatusChange,
    onToast, onLoadProgress, onReady,
    onHandLandmarks, onDismissHome,
  } = callbacks;

  const ctx = canvas.getContext('2d');
  let landmarker = null;
  let running = true;

  const cards = [];
  let grabbedCard = null;
  let grabOff = { x: 0, y: 0 };
  let zTop = 20;
  let schemeIdx = 0;
  let prevSpread = null;
  let lastRPos = { x: 0, y: 0 };
  let ghostComp = null;

  const hs = {
    create: 0, fist: 0, point: 0,
    prevFingers: -1, cooldown: 0,
  };

  let ws = null;
  let prevHudKey = '';
  let homeActive = true;

  // ── Helpers ──────────────────────────────────────────

  function setHUD(key) {
    if (key === prevHudKey) return;
    prevHudKey = key;
    const h = HUDS[key] || HUDS.ready;
    onHudChange({ emoji: h.e, text: h.t, active: key !== 'idle' && key !== 'ready' });
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // ── Ghost ────────────────────────────────────────────

  function showGhost(comp, sx, sy) {
    if (ghostComp !== comp) {
      ghostLabel.textContent = comp.name;
      ghostBody.innerHTML = comp.html();
      ghostComp = comp;
    }
    ghost.style.display = 'block';
    ghost.style.left = (sx + 22) + 'px';
    ghost.style.top = (sy - 28) + 'px';
  }

  function hideGhost() {
    ghost.style.display = 'none';
    ghostComp = null;
  }

  // ── Card lifecycle ───────────────────────────────────

  function spawnCard(comp, sx, sy) {
    const sr = stage.getBoundingClientRect();
    const x = Math.max(0, Math.min(sr.width - 240, sx - sr.left - 110));
    const y = Math.max(0, Math.min(sr.height - 120, sy - sr.top - 50));
    const el = document.createElement('div');
    el.className = 'card';
    el.style.cssText = `left:${x}px;top:${y}px;width:220px;z-index:${zTop++};opacity:0;transform:scale(0.9) translateY(8px)`;
    el.innerHTML = `<div class="card-bar"><span class="card-label">${comp.name}</span><div class="card-dots"><div class="cd"></div><div class="cd"></div><div class="cd"></div></div></div><div class="card-body">${comp.html()}</div>`;
    const data = { el, comp, id: comp.id };
    cards.push(data);
    stage.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.22s, transform 0.22s';
      el.style.opacity = '1';
      el.style.transform = 'scale(1) translateY(0)';
      setTimeout(() => { el.style.transition = ''; }, 250);
    });
    el.addEventListener('mousedown', (e) => mouseGrab(e, data));
    onCardCountChange(cards.length);
    return data;
  }

  function grabCard(data, sx, sy) {
    if (grabbedCard && grabbedCard !== data) ungrab();
    grabbedCard = data;
    const r = data.el.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    grabOff = { x: sx - (r.left - sr.left), y: sy - (r.top - sr.top) };
    data.el.classList.add('grabbed');
    data.el.style.zIndex = zTop++;
  }

  function moveGrabbed(sx, sy) {
    if (!grabbedCard) return;
    const sw = stage.offsetWidth;
    const sh = stage.offsetHeight;
    const w = grabbedCard.el.offsetWidth;
    const h = grabbedCard.el.offsetHeight;
    grabbedCard.el.style.left = Math.max(0, Math.min(sw - w, sx - grabOff.x)) + 'px';
    grabbedCard.el.style.top = Math.max(0, Math.min(sh - h, sy - grabOff.y)) + 'px';
  }

  function ungrab() {
    if (!grabbedCard) return;
    grabbedCard.el.classList.remove('grabbed');
    grabbedCard = null;
  }

  function deleteNearOrGrabbed() {
    const target = grabbedCard || findNearest(lastRPos.x, lastRPos.y, 160);
    if (!target) return;
    const el = target.el;
    ungrab();
    el.style.transition = 'opacity 0.2s, transform 0.2s';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.85) translateY(4px)';
    setTimeout(() => {
      el.remove();
      const idx = cards.indexOf(target);
      if (idx !== -1) cards.splice(idx, 1);
      onCardCountChange(cards.length);
    }, 220);
    onToast('Component removed');
  }

  function resizeGrabbed(delta) {
    if (!grabbedCard) return;
    const el = grabbedCard.el;
    el.style.width = Math.max(160, Math.min(520, el.offsetWidth * delta)) + 'px';
  }

  function findNearest(mx, my, threshold = 120) {
    let best = null;
    let bestD = threshold;
    cards.forEach((c) => {
      const r = c.el.getBoundingClientRect();
      const d = Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height / 2));
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }

  function clearAll() {
    cards.forEach((c) => c.el.remove());
    cards.length = 0;
    grabbedCard = null;
    onCardCountChange(0);
    onToast('Canvas cleared');
  }

  // ── Skeleton drawing (MIRRORED coords — no CSS transform) ──

  function drawSkeleton(lm, baseColor) {
    const W = canvas.width;
    const H = canvas.height;
    const px = (n) => (1 - lm[n].x) * W;
    const py = (n) => lm[n].y * H;

    ctx.strokeStyle = baseColor.replace('0.9', '0.18');
    ctx.lineWidth = 1.2;
    CONN.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
      ctx.stroke();
    });
    lm.forEach((_, i) => {
      const isTip = [4, 8, 12, 16, 20].includes(i);
      ctx.beginPath();
      ctx.arc(px(i), py(i), isTip ? 4.5 : i === 0 ? 5 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = (i === 4 || i === 8) ? baseColor : baseColor.replace('0.9', '0.42');
      ctx.fill();
    });
  }

  // ── Ring ──────────────────────────────────────────────

  function setRing(frames, maxF, sx, sy, show) {
    if (!show || frames === 0) { ring.style.display = 'none'; return; }
    ring.style.display = 'block';
    ring.style.left = (sx - 32) + 'px';
    ring.style.top = (sy - 32) + 'px';
    ringArc.style.strokeDashoffset = 169.6 - (frames / maxF) * 169.6;
  }

  function hideAllRings() { ring.style.display = 'none'; }

  function hideCursors() { cursor.style.display = 'none'; }

  // ── WebSocket ────────────────────────────────────────

  function wsConnect() {
    const wsUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000') + '/api/v1/ws/webapp/default';
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      onStatusChange((s) => ({ ...s, ws: false }));
      setTimeout(wsConnect, 4000);
      return;
    }
    ws.onopen = () => {
      onStatusChange((s) => ({ ...s, ws: true }));
      onToast('Figma relay connected');
    };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === 'ACK') onToast(`↑ ${m.components} sent to Figma`);
        if (m.type === 'PLACED_ACK') onToast(`✓ Figma placed ${m.count} node${m.count !== 1 ? 's' : ''}`);
      } catch { /* ignore */ }
    };
    ws.onerror = () => {
      onStatusChange((s) => ({ ...s, ws: false }));
    };
    ws.onclose = () => {
      onStatusChange((s) => ({ ...s, ws: false }));
      ws = null;
      if (running) setTimeout(wsConnect, 4000);
    };
  }

  function syncFigma() {
    if (!cards.length) { onToast('No components to sync'); return; }
    const payload = {
      type: 'SYNC_COMPONENTS',
      components: cards.map((c) => ({
        type: c.id,
        x: parseInt(c.el.style.left) || 0,
        y: parseInt(c.el.style.top) || 0,
        width: c.el.offsetWidth,
        height: c.el.offsetHeight,
        colorScheme: SCHEMES[schemeIdx] || 'default',
      })),
    };
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
      onToast(`↑ Syncing ${cards.length} component${cards.length !== 1 ? 's' : ''}…`);
    } else {
      console.log('[TACTILE] payload:', JSON.stringify(payload, null, 2));
      onToast('Not connected — payload in console');
      wsConnect();
    }
  }

  // ── Mouse fallback ───────────────────────────────────

  function mouseGrab(e, data) {
    e.preventDefault();
    const sr = stage.getBoundingClientRect();
    grabCard(data, e.clientX - sr.left, e.clientY - sr.top);
    const onMove = (ev) => moveGrabbed(ev.clientX - sr.left, ev.clientY - sr.top);
    const onUp = () => {
      ungrab();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ── Main loop ────────────────────────────────────────

  function loop() {
    if (!running) return;
    if (!landmarker || video.readyState < 2) {
      requestAnimationFrame(loop);
      return;
    }

    {
      const res = landmarker.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const lms = res.landmarks || [];
      const hands = res.handednesses || [];
      let rightLm = null, leftLm = null;
      for (let i = 0; i < lms.length; i++) {
        const label = hands[i]?.[0]?.categoryName;
        if (label === 'Left') rightLm = lms[i];
        else if (label === 'Right') leftLm = lms[i];
      }
      if (!rightLm && lms.length === 1) rightLm = lms[0];

      onStatusChange((s) => {
        const newHand = !!rightLm;
        if (s.hand === newHand) return s;
        return { ...s, hand: newHand };
      });

      if (!rightLm) {
        hs.create = hs.fist = hs.point = 0;
        hideGhost();
        ungrab();
        setHUD('idle');
        hideAllRings();
        hideCursors();
        if (onHandLandmarks) onHandLandmarks([]);
        requestAnimationFrame(loop);
        return;
      }

      // Send full landmark data to home screen for ASCII hand rendering
      if (homeActive) {
        const allHands = [];
        allHands.push(rightLm);
        if (leftLm) allHands.push(leftLm);
        if (onHandLandmarks) onHandLandmarks(allHands);
        hideCursors();
      } else {
        drawSkeleton(rightLm, 'rgba(240,240,236,0.9)');
      }

      let hudKey = 'ready';

      // Pinch midpoint — mirrored X for screen coords
      const pmx = (1 - (rightLm[4].x + rightLm[8].x) / 2) * window.innerWidth;
      const pmy = ((rightLm[4].y + rightLm[8].y) / 2) * window.innerHeight;
      lastRPos = { x: pmx, y: pmy };

      if (!homeActive) {
        cursor.style.display = 'block';
        cursor.style.left = pmx + 'px';
        cursor.style.top = pmy + 'px';
      }

      const g = classifyGesture(rightLm);
      const comp = GESTURE_TO_COMP[g] || null;

      if (homeActive && g === 'peace') {
        homeActive = false;
        if (onDismissHome) onDismissHome();
      }

      if (!homeActive) {
        cursor.classList.toggle('pinch', g === 'pinch');

        const sr = stage.getBoundingClientRect();
        const sx = pmx - sr.left;
        const sy = pmy - sr.top;

        if (hs.cooldown > 0) hs.cooldown--;

        if (g === 'pinch') {
          hs.create = hs.fist = hs.point = 0;
          hideGhost();
          setRing(0, 1, 0, 0, false);
          hudKey = 'pinch';

          cards.forEach((c) => c.el.classList.remove('near'));
          if (!grabbedCard) {
            const near = findNearest(pmx, pmy, 130);
            if (near) { near.el.classList.add('near'); grabCard(near, sx, sy); }
          } else {
            moveGrabbed(sx, sy);
          }
        } else {
          if (grabbedCard) ungrab();
          cards.forEach((c) => c.el.classList.remove('near'));

          if (g === 'fist') {
            hs.create = hs.point = 0;
            hs.fist++;
            hideGhost();
            hudKey = 'fist';
            setRing(hs.fist, HOLD_ACT, pmx, pmy, true);
            if (hs.fist >= HOLD_ACT) {
              deleteNearOrGrabbed();
              hs.fist = 0;
              setRing(0, 1, 0, 0, false);
            }
          } else if (g === 'gun') {
            hs.create = hs.fist = 0;
            hs.point++;
            hideGhost();
            hudKey = 'point';
            setRing(hs.point, HOLD_ACT, pmx, pmy, true);
            if (hs.point >= HOLD_ACT) {
              syncFigma();
              hs.point = 0;
              setRing(0, 1, 0, 0, false);
            }
          } else if (g === 'open' || g === 'neutral') {
            hs.create = hs.fist = hs.point = 0;
            hs.prevFingers = -1;
            hideGhost();
            setRing(0, 1, 0, 0, false);
            hudKey = 'ready';
          } else if (comp) {
            hs.fist = hs.point = 0;

            if (hs.prevFingers !== g) { hs.create = 0; hideGhost(); }
            hs.prevFingers = g;

            if (hs.cooldown > 0) {
              hudKey = 'cool';
              showGhost(comp, pmx, pmy);
              setRing(0, 1, 0, 0, false);
            } else {
              hs.create++;
              hudKey = 'create_' + g;
              showGhost(comp, pmx, pmy);
              if (hs.create >= CREATE_DBG) {
                hideGhost();
                spawnCard(comp, pmx, pmy);
                onToast(comp.name + ' created');
                hs.create = 0;
                hs.cooldown = CREATE_CD;
                hs.prevFingers = -1;
              }
            }
          } else {
            hs.create = hs.fist = hs.point = 0;
            hs.prevFingers = -1;
            hideGhost();
            setRing(0, 1, 0, 0, false);
          }
        }

        if (leftLm) {
          drawSkeleton(leftLm, 'rgba(240,240,236,0.9)');
        }

        // Two-hand resize
        if (leftLm && grabbedCard) {
          const r9 = rightLm[9];
          const l9 = leftLm[9];
          const spread = Math.hypot(r9.x - l9.x, r9.y - l9.y);
          if (prevSpread !== null) {
            const delta = spread / prevSpread;
            if (Math.abs(delta - 1) > 0.004) {
              resizeGrabbed(delta);
              if (hudKey === 'pinch') hudKey = 'spread';
            }
          }
          prevSpread = spread;
        } else {
          prevSpread = null;
        }

        setHUD(hudKey);
      }
    }

    requestAnimationFrame(loop);
  }

  // ── Init ─────────────────────────────────────────────

  async function init() {
    resize();
    window.addEventListener('resize', resize);

    onLoadProgress(15, 'Requesting camera…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      video.srcObject = stream;
      await new Promise((r) => { video.onloadedmetadata = r; });
      onStatusChange((s) => ({ ...s, cam: true }));
    } catch {
      onLoadProgress(100, 'Camera unavailable — mouse mode');
      setTimeout(() => onReady(), 800);
      return;
    }

    onLoadProgress(50, 'Loading MediaPipe model…');
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm',
      );
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.4,
      });
      onStatusChange((s) => ({ ...s, mp: true }));
    } catch (e) {
      console.warn('MediaPipe unavailable', e);
      onLoadProgress(100, 'Hand tracking unavailable — mouse only');
      setTimeout(() => onReady(), 800);
      return;
    }

    onLoadProgress(100, 'ready');
    setTimeout(() => {
      onReady();
      requestAnimationFrame(loop);
    }, 600);

    wsConnect();
  }

  function destroy() {
    running = false;
    window.removeEventListener('resize', resize);
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    if (landmarker) { landmarker.close(); landmarker = null; }
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }

  return { init, destroy, clearAll, syncFigma };
}
