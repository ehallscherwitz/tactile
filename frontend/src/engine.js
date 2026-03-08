import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { classifyGesture } from './lib/gestures';
import { spreadToBreakpoint, KEYBOARD_MAP } from './lib/components';

const THUMB_TRIGGER_FRAMES = 6;
const STYLE_EDITOR_COOLDOWN_MS = 800;   // ignore thumb after toggle to prevent rapid open/close
const PALM_CREATE_FRAMES = 8;    // ~0.35s
const ROCK_DELETE_FRAMES = 12;   // ~0.5s hold to delete

const CONN = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const HUDS = {
  point:        { t: 'Cursor -- point to select' },
  pinch:        { t: 'Click -- selecting' },
  scroll:       { t: 'Scroll mode' },
  thumb:        { t: 'Style editor' },
  open_ready:   { t: 'Open palm over frame -- move to drag' },
  grab:         { t: 'Dragging frame' },
  rock_delete:  { t: 'Rock sign -- hold to delete frame...' },
  two_palm:     { t: 'Two palms -- hold to create frame' },
  two_peace:    { t: 'Two peace signs -- spread to resize' },
  idle:         { t: 'Show your hands to begin' },
  ready:        { t: 'Make a gesture to start' },
};

export function createEngine(refs, callbacks) {
  const { video, canvas, cursor, ring, ringArc } = refs;

  const {
    onHudChange, onStatusChange,
    onToast, onLoadProgress, onReady,
    onHandLandmarks, onDismissHome,
    onCreateFrame, onResizeFrame,
    onToggleStyleEditor, onCursorMove,
    onCursorClick, onScrollDelta,
    onDragStart, onDragMove, onDragEnd,
    onDeleteFrame,
  } = callbacks;

  const ctx = canvas.getContext('2d');
  let landmarker = null;
  let running = true;

  const hs = {
    thumb: 0,
    palmCreate: 0,
    rock: 0,
    prevGesture: '',
    prevScrollY: null,
    dragging: false,
    openOverFrameFrames: 0,
    openDragAnchor: null,
    neutralFrames: 0,
    smPalmX: null,
    smPalmY: null,
    styleEditorCooldownUntil: 0,
  };

  let prevHudKey = '';
  let homeActive = true;

  function setHUD(key) {
    if (key === prevHudKey) return;
    prevHudKey = key;
    const h = HUDS[key] || HUDS.ready;
    onHudChange({ text: h.t, active: key !== 'idle' && key !== 'ready' });
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function setRing(frames, maxF, sx, sy, show) {
    if (!show || frames === 0) { ring.style.display = 'none'; return; }
    ring.style.display = 'block';
    ring.style.left = (sx - 32) + 'px';
    ring.style.top = (sy - 32) + 'px';
    ringArc.style.strokeDashoffset = 169.6 - (frames / maxF) * 169.6;
  }

  function hideRing() { ring.style.display = 'none'; }
  function hideCursors() { cursor.style.display = 'none'; }

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
      ctx.fillStyle = isTip ? baseColor : baseColor.replace('0.9', '0.42');
      ctx.fill();
    });
  }

  function resetHoldCounters(clearThumb = true) {
    if (clearThumb) hs.thumb = 0;
    hs.palmCreate = 0;
    hs.rock = 0;
    hs.openOverFrameFrames = 0;
    hs.openDragAnchor = null;
    hs.neutralFrames = 0;
  }

  const DRAG_THRESHOLD = 8;
  const PALM_SMOOTH = 0.35;
  const MAX_PALM_DELTA = 60;

  function endDragIfActive() {
    if (hs.dragging) { onDragEnd(); hs.dragging = false; }
  }

  // ── Keyboard & mouse fallback ─────────────────────

  let mouseDown = false;
  let mouseDragActive = false;

  function onKeyDown(e) {
    const action = KEYBOARD_MAP[e.key];
    if (!action) return;
    e.preventDefault();

    if (homeActive && e.key === 'f') {
      homeActive = false;
      if (onDismissHome) onDismissHome();
    }

    switch (action) {
      case 'create_frame':
        if (!homeActive) { onCreateFrame(); onToast('Frame created'); }
        break;
      case 'breakpoint_mobile':
      case 'breakpoint_tablet':
      case 'breakpoint_laptop':
      case 'breakpoint_desktop': {
        if (!homeActive) {
          const bp = action.replace('breakpoint_', '');
          onResizeFrame(bp);
          onToast('Breakpoint: ' + bp);
        }
        break;
      }
      case 'delete_frame':
        if (!homeActive) { onDeleteFrame(); onToast('Frame deleted'); }
        break;
      case 'toggle_editor':
        if (!homeActive) {
          onToggleStyleEditor();
          hs.styleEditorCooldownUntil = performance.now() + STYLE_EDITOR_COOLDOWN_MS;
        }
        break;
      case 'close_editor':
        if (!homeActive) onToggleStyleEditor(true);
        break;
    }
  }

  function onMouseMove(e) {
    if (homeActive) return;
    onCursorMove(e.clientX, e.clientY);
    if (mouseDown && mouseDragActive) onDragMove(e.clientX, e.clientY);
  }

  function onMouseDown(e) {
    if (homeActive || e.button !== 0) return;
    mouseDown = true;
    const frameEl = document.querySelector('.design-frame-wrapper');
    if (frameEl) {
      const r = frameEl.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        mouseDragActive = true;
        onDragStart(e.clientX, e.clientY);
        return;
      }
    }
    onCursorClick(e.clientX, e.clientY);
  }

  function onMouseUp() {
    if (mouseDown && mouseDragActive) { onDragEnd(); mouseDragActive = false; }
    mouseDown = false;
  }

  function onWheel(e) {
    if (!homeActive) onScrollDelta(e.deltaY);
  }

  // ── Main loop ─────────────────────────────────────

  function loop() {
    if (!running) return;
    if (!landmarker || video.readyState < 2) {
      requestAnimationFrame(loop);
      return;
    }

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

    // Two-hand gestures require MediaPipe to detect 2 distinct hands
    const hasTwoHands = lms.length >= 2 && rightLm && leftLm;

    onStatusChange((s) => {
      const newHand = !!rightLm;
      if (s.hand === newHand) return s;
      return { ...s, hand: newHand };
    });

    // No hands detected
    if (!rightLm) {
      resetHoldCounters();
      hs.prevScrollY = null;
      endDragIfActive();
      setHUD('idle');
      hideRing();
      hideCursors();
      if (onHandLandmarks) onHandLandmarks([]);
      requestAnimationFrame(loop);
      return;
    }

    // Home screen: peace sign to enter
    if (homeActive) {
      const allHands = [rightLm];
      if (leftLm) allHands.push(leftLm);
      if (onHandLandmarks) onHandLandmarks(allHands);
      hideCursors();
      if (classifyGesture(rightLm) === 'peace') {
        homeActive = false;
        if (onDismissHome) onDismissHome();
      }
      requestAnimationFrame(loop);
      return;
    }

    // Draw skeletons
    drawSkeleton(rightLm, 'rgba(240,240,236,0.9)');
    if (leftLm) drawSkeleton(leftLm, 'rgba(240,240,236,0.9)');

    const W = window.innerWidth;
    const H = window.innerHeight;
    const tipX = (1 - rightLm[8].x) * W;
    const tipY = rightLm[8].y * H;
    const palmX = (1 - rightLm[9].x) * W;
    const palmY = rightLm[9].y * H;

    const gRight = classifyGesture(rightLm);
    const gLeft = leftLm ? classifyGesture(leftLm) : null;

    let hudKey = 'ready';

    // ═══ TWO-HAND GESTURES (checked first — always override single-hand) ═══

    // --- Two open palms: CREATE FRAME ---
    if (hasTwoHands && gRight === 'open' && gLeft === 'open') {
      hs.palmCreate++;
      endDragIfActive();
      hs.prevScrollY = null;
      hs.thumb = 0;

      const midX = ((1 - rightLm[9].x) + (1 - leftLm[9].x)) / 2 * W;
      const midY = (rightLm[9].y + leftLm[9].y) / 2 * H;
      setRing(hs.palmCreate, PALM_CREATE_FRAMES, midX, midY, true);
      hudKey = 'two_palm';
      hideCursors();

      if (hs.palmCreate >= PALM_CREATE_FRAMES) {
        onCreateFrame();
        onToast('Frame created');
        hs.palmCreate = 0;
        hideRing();
      }
    }

    // --- Two peace signs: RESIZE FRAME ---
    else if (hasTwoHands && gRight === 'peace' && gLeft === 'peace') {
      resetHoldCounters();
      endDragIfActive();
      hs.prevScrollY = null;
      hideRing();
      hideCursors();

      const rMid = rightLm[9];
      const lMid = leftLm[9];
      const dist = Math.hypot(rMid.x - lMid.x, rMid.y - lMid.y);
      const bp = spreadToBreakpoint(dist);
      onResizeFrame(bp);
      hudKey = 'two_peace';
    }

    // ═══ SINGLE-HAND GESTURES ═══════════════════════

    // --- Rock/Horns: DELETE FRAME (hold 2s) ---
    else if (gRight === 'rock') {
      hs.rock++;
      hs.thumb = 0;
      hs.palmCreate = 0;
      endDragIfActive();
      hs.prevScrollY = null;

      const midX = (1 - (rightLm[8].x + rightLm[20].x) / 2) * W;
      const midY = ((rightLm[8].y + rightLm[20].y) / 2) * H;
      setRing(hs.rock, ROCK_DELETE_FRAMES, midX, midY, true);
      hudKey = 'rock_delete';
      hideCursors();

      if (hs.rock >= ROCK_DELETE_FRAMES) {
        onDeleteFrame();
        onToast('Frame deleted');
        hs.rock = 0;
        hideRing();
      }
    }

    // --- Point: CURSOR MODE ---
    else if (gRight === 'point') {
      resetHoldCounters();
      endDragIfActive();
      hideRing();
      cursor.style.display = 'block';
      cursor.className = 'hand-cursor cursor-select';
      cursor.style.left = tipX + 'px';
      cursor.style.top = tipY + 'px';
      onCursorMove(tipX, tipY);
      hudKey = 'point';
    }

    // --- Pinch: CLICK ---
    else if (gRight === 'pinch') {
      resetHoldCounters();
      endDragIfActive();
      hideRing();

      const pmx = (1 - (rightLm[4].x + rightLm[8].x) / 2) * W;
      const pmy = ((rightLm[4].y + rightLm[8].y) / 2) * H;
      cursor.style.display = 'block';
      cursor.className = 'hand-cursor cursor-click';
      cursor.style.left = pmx + 'px';
      cursor.style.top = pmy + 'px';

      if (hs.prevGesture !== 'pinch') {
        onCursorClick(pmx, pmy);
      }
      hudKey = 'pinch';
    }

    // --- Peace (one hand): SCROLL — either hand ---
    else if ((gRight === 'peace' && gLeft !== 'peace') || (gRight !== 'peace' && gLeft === 'peace')) {
      resetHoldCounters();
      endDragIfActive();
      hideRing();

      const scrollLm = gRight === 'peace' ? rightLm : leftLm;
      const midY = (scrollLm[8].y + scrollLm[12].y) / 2;
      const scrollScreenY = midY * H;
      const scrollTipX = (1 - scrollLm[8].x) * W;

      cursor.style.display = 'block';
      cursor.className = 'hand-cursor cursor-scroll';
      cursor.style.left = scrollTipX + 'px';
      cursor.style.top = scrollScreenY + 'px';

      if (hs.prevScrollY !== null) {
        const delta = (midY - hs.prevScrollY) * H * 2;
        if (Math.abs(delta) > 1) onScrollDelta(delta);
      }
      hs.prevScrollY = midY;
      hudKey = 'scroll';
    }

    // --- Thumbs up: STYLE EDITOR ---
    else if (gRight === 'thumb') {
      hs.neutralFrames = 0;
      const now = performance.now();
      if (now < hs.styleEditorCooldownUntil) {
        hs.thumb = 0;
        hideRing();
      } else {
        hs.thumb++;
        const thumbX = (1 - rightLm[4].x) * W;
        const thumbY = rightLm[4].y * H;
        if (hs.thumb >= THUMB_TRIGGER_FRAMES) {
          onToggleStyleEditor();
          onToast('Style editor toggled');
          hs.thumb = 0;
          hs.styleEditorCooldownUntil = now + STYLE_EDITOR_COOLDOWN_MS;
          hideRing();
        } else {
          setRing(hs.thumb, THUMB_TRIGGER_FRAMES, thumbX, thumbY, true);
        }
      }
      hs.palmCreate = 0;
      endDragIfActive();
      hs.prevScrollY = null;
      hideCursors();
      hudKey = 'thumb';
    }

    // --- Open palm (one hand): DRAG when over frame + move ---
    else if (gRight === 'open') {
      hs.thumb = 0;
      hs.palmCreate = 0;
      hs.rock = 0;
      hs.prevScrollY = null;
      hideRing();
      hideCursors();

      const frameEl = document.querySelector('.design-frame-wrapper');
      const GRAB_PAD = 28;
      const overFrame = frameEl && (() => {
        const r = frameEl.getBoundingClientRect();
        return palmX >= r.left - GRAB_PAD && palmX <= r.right + GRAB_PAD &&
               palmY >= r.top - GRAB_PAD && palmY <= r.bottom + GRAB_PAD;
      })();

      if (overFrame) {
        if (hs.openDragAnchor === null) {
          hs.openDragAnchor = { x: palmX, y: palmY };
        }
        const dx = palmX - hs.openDragAnchor.x;
        const dy = palmY - hs.openDragAnchor.y;
        const moved = Math.hypot(dx, dy) >= DRAG_THRESHOLD;
        if (!hs.dragging && moved) {
          hs.dragging = true;
          hs.smPalmX = hs.openDragAnchor.x;
          hs.smPalmY = hs.openDragAnchor.y;
          onDragStart(hs.openDragAnchor.x, hs.openDragAnchor.y);
        }
        if (hs.dragging) {
          let px = palmX, py = palmY;
          if (hs.smPalmX !== null) {
            const dx = Math.max(-MAX_PALM_DELTA, Math.min(MAX_PALM_DELTA, palmX - hs.smPalmX));
            const dy = Math.max(-MAX_PALM_DELTA, Math.min(MAX_PALM_DELTA, palmY - hs.smPalmY));
            px = hs.smPalmX + dx;
            py = hs.smPalmY + dy;
          }
          hs.smPalmX = px;
          hs.smPalmY = py;
          onDragMove(px, py);
          hudKey = 'grab';
          hs.openDragAnchor = { x: palmX, y: palmY };
        } else {
          hudKey = 'open_ready';
        }
      } else {
        if (hs.dragging) {
          onDragEnd();
          hs.dragging = false;
          hs.smPalmX = null;
          hs.smPalmY = null;
        }
        hs.openDragAnchor = null;
      }
    }

    // --- Neutral / Fist / other: RESET ---
    else {
      if (hs.dragging) {
        onDragEnd();
        hs.dragging = false;
        hs.smPalmX = null;
        hs.smPalmY = null;
      }
      hs.openDragAnchor = null;
      hs.neutralFrames++;
      // Only clear thumb counter after 3+ frames of neutral (avoids flicker reset)
      resetHoldCounters(hs.neutralFrames >= 3);
      hs.prevScrollY = null;
      endDragIfActive();
      hideRing();
      hideCursors();
    }

    hs.prevGesture = gRight;
    setHUD(hudKey);
    requestAnimationFrame(loop);
  }

  // ── Init ──────────────────────────────────────────

  async function init() {
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel, { passive: true });

    onLoadProgress(15, 'Requesting camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      video.srcObject = stream;
      await new Promise((r) => { video.onloadedmetadata = r; });
      onStatusChange((s) => ({ ...s, cam: true }));
    } catch {
      onLoadProgress(100, 'Camera unavailable -- mouse & keyboard mode');
      onToast('No camera. Use keyboard (F, 1-4, E) and mouse.');
      setTimeout(() => onReady(), 800);
      return;
    }

    onLoadProgress(50, 'Loading MediaPipe model...');
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
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.55,
      });
      onStatusChange((s) => ({ ...s, mp: true }));
    } catch (e) {
      console.warn('MediaPipe unavailable', e);
      onLoadProgress(100, 'Hand tracking unavailable -- mouse & keyboard only');
      onToast('MediaPipe failed. Use keyboard (F, 1-4, E) and mouse.');
      setTimeout(() => onReady(), 800);
      return;
    }

    onLoadProgress(100, 'ready');
    setTimeout(() => {
      onReady();
      requestAnimationFrame(loop);
    }, 600);
  }

  function destroy() {
    running = false;
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('wheel', onWheel);
    if (landmarker) { landmarker.close(); landmarker = null; }
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }

  return { init, destroy };
}
