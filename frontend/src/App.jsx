import { useState, useRef, useEffect, useCallback } from 'react';
import { createEngine } from './engine';
import { BREAKPOINTS, FONT_OPTIONS, COLOR_SCHEMES, FONT_SIZES, BORDER_RADII } from './lib/components';
import TopBar from './components/TopBar';
import StatusBar from './components/StatusBar';
import Legend from './components/Legend';
import LoadingScreen from './components/LoadingScreen';
import AsciiCloudHome from './components/AsciiCloudHome';
import Toast from './components/Toast';
import DesignFrame from './components/DesignFrame';
import StyleEditor from './components/StyleEditor';

const DEFAULT_STYLES = {
  font: FONT_OPTIONS[0],
  colorScheme: COLOR_SCHEMES[0],
  effects: [],
  fontSize: 'base',
  fontWeight: 'regular',
  lineHeight: 'normal',
  letterSpacing: 'normal',
  textTransform: 'none',
  opacity: '100',
  borderRadius: 'md',
  borderWidth: 'thin',
  shadow: 'none',
  padding: 'normal',
  sectionGap: 'normal',
  elementGap: 'normal',
  contentWidth: 'standard',
  alignment: 'left',
  heroLayout: 'side-by-side',
};

const API_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const BACKEND_TO_FRONTEND_SCHEME = {
  warm: 'amber',
  cool: 'ocean',
  dark: 'midnight',
  bright: 'mono',
  soft: 'violet',
  moon: 'midnight',
};

const FRONTEND_TO_BACKEND_SCHEME = {
  ocean: 'cool',
  violet: 'soft',
  mint: 'soft',
  amber: 'warm',
  rose: 'soft',
  mono: 'bright',
  midnight: 'dark',
  sunset: 'warm',
  forest: 'warm',
};

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return null;
  const n = Number.parseInt(clean, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function closestFontSizeId(px) {
  const target = Number(px) || 16;
  let best = FONT_SIZES[0];
  let bestDiff = Infinity;
  for (const opt of FONT_SIZES) {
    const val = Number.parseInt(String(opt.value).replace('px', ''), 10) || 16;
    const diff = Math.abs(val - target);
    if (diff < bestDiff) {
      best = opt;
      bestDiff = diff;
    }
  }
  return best.id;
}

function closestRadiusId(px) {
  const target = Number(px) || 8;
  let best = BORDER_RADII[0];
  let bestDiff = Infinity;
  for (const opt of BORDER_RADII) {
    const val = Number.parseInt(String(opt.value).replace('px', ''), 10) || 0;
    const diff = Math.abs(val - target);
    if (diff < bestDiff) {
      best = opt;
      bestDiff = diff;
    }
  }
  return best.id;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [homeScreen, setHomeScreen] = useState(true);
  const [loadPct, setLoadPct] = useState(0);
  const [loadText, setLoadText] = useState('Initializing...');
  const [hudInfo, setHudInfo] = useState({ text: 'Show your hands to begin', active: false });
  const [toast, setToast] = useState({ msg: '', visible: false });
  const [status, setStatus] = useState({ cam: false, mp: false, hand: false });
  const [handLandmarks, setHandLandmarks] = useState([]);

  // Frame state
  const [frameVisible, setFrameVisible] = useState(false);
  const [breakpoint, setBreakpoint] = useState('desktop');
  const [framePos, setFramePos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  // Style state
  const [styles, setStyles] = useState({ ...DEFAULT_STYLES });
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [componentStyles, setComponentStyles] = useState({});
  const [workflowId, setWorkflowId] = useState(null);
  const [pulledFrameState, setPulledFrameState] = useState(null);
  const [syncBusy, setSyncBusy] = useState({ pull: false, push: false });

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const ringArcRef = useRef(null);
  const engineRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast({ msg, visible: true });
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 2200);
  }, []);

  const handleCreateFrame = useCallback(() => {
    setFrameVisible(true);
  }, []);

  const handleResizeFrame = useCallback((bp) => {
    setBreakpoint(bp);
  }, []);

  const handlePullFromFigma = useCallback(async () => {
    if (syncBusy.pull) return;
    setSyncBusy((s) => ({ ...s, pull: true }));
    try {
      const resp = await fetch(`${API_BASE}/api/v1/ai/pull-from-figma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: 'default',
          base_card_id: 'frontend-workflow',
        }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body?.detail || `Pull failed (${resp.status})`);

      const fs = body?.frame_state || {};
      setWorkflowId(body.workflow_id || null);
      setPulledFrameState(fs);
      setFrameVisible(true);

      const backendScheme = String(fs.color_scheme || 'dark').toLowerCase();
      const frontendSchemeId = BACKEND_TO_FRONTEND_SCHEME[backendScheme] || 'midnight';
      const frontendScheme = COLOR_SCHEMES.find((x) => x.id === frontendSchemeId) || COLOR_SCHEMES[0];
      const pulledFont = String(fs.font_family || '').toLowerCase();
      const fontOpt = FONT_OPTIONS.find((f) => f.name.toLowerCase() === pulledFont)
        || FONT_OPTIONS.find((f) => pulledFont.includes(f.name.toLowerCase()))
        || FONT_OPTIONS[0];

      setStyles((prev) => ({
        ...prev,
        font: fontOpt,
        colorScheme: frontendScheme,
        fontSize: closestFontSizeId(fs.font_size),
        borderRadius: closestRadiusId(fs.corner_radius),
        effects: fs.liquid_glass ? ['liquid-glass'] : [],
      }));

      showToast('Pulled context from Figma');
    } catch (err) {
      showToast(`Pull failed: ${String(err?.message || err)}`);
    } finally {
      setSyncBusy((s) => ({ ...s, pull: false }));
    }
  }, [showToast, syncBusy.pull]);

  const handlePushToFigma = useCallback(async () => {
    if (syncBusy.push) return;
    if (!workflowId) {
      showToast('Pull from Figma first');
      return;
    }
    setSyncBusy((s) => ({ ...s, push: true }));
    try {
      const bp = BREAKPOINTS[breakpoint] || BREAKPOINTS.desktop;
      const cs = styles.colorScheme || COLOR_SCHEMES[0];
      const backendScheme = FRONTEND_TO_BACKEND_SCHEME[cs.id] || 'dark';
      const sizeOpt = FONT_SIZES.find((o) => o.id === styles.fontSize) || FONT_SIZES[2];
      const radiusOpt = BORDER_RADII.find((o) => o.id === styles.borderRadius) || BORDER_RADII[2];

      const finalFrameState = {
        ...(pulledFrameState || {}),
        width: bp.width,
        height: Number(pulledFrameState?.height) || 900,
        color_scheme: backendScheme,
        fill_rgb: hexToRgb(cs.bg) || pulledFrameState?.fill_rgb,
        text_rgb: hexToRgb(cs.text) || pulledFrameState?.text_rgb,
        accent_rgb: hexToRgb(cs.primary) || pulledFrameState?.accent_rgb,
        font_family: styles.font?.name || pulledFrameState?.font_family || 'Inter',
        font_size: Number.parseInt(String(sizeOpt.value).replace('px', ''), 10) || 16,
        corner_radius: Number.parseInt(String(radiusOpt.value).replace('px', ''), 10) || 8,
        liquid_glass: (styles.effects || []).includes('liquid-glass'),
      };

      const resp = await fetch(`${API_BASE}/api/v1/ai/push-to-figma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: 'default',
          workflow_id: workflowId,
          final_frame_state: finalFrameState,
        }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body?.detail || `Push failed (${resp.status})`);
      showToast('Pushed derived frame to Figma');
    } catch (err) {
      showToast(`Push failed: ${String(err?.message || err)}`);
    } finally {
      setSyncBusy((s) => ({ ...s, push: false }));
    }
  }, [breakpoint, pulledFrameState, showToast, styles, syncBusy.push, workflowId]);

  const handleDeleteFrame = useCallback(() => {
    setFrameVisible(false);
    setSelectedComponent(null);
    setComponentStyles({});
    setFramePos(null);
    setEditorOpen(false);
  }, []);

  const handleToggleStyleEditor = useCallback((forceClose) => {
    if (forceClose === true) {
      setEditorOpen(false);
    } else {
      setEditorOpen((v) => !v);
    }
  }, []);

  const handleStyleChange = useCallback((key, value) => {
    if (selectedComponent) {
      setComponentStyles((prev) => ({
        ...prev,
        [selectedComponent]: { ...(prev[selectedComponent] || {}), [key]: value },
      }));
    } else {
      setStyles((prev) => ({ ...prev, [key]: value }));
    }
  }, [selectedComponent]);

  const handleCursorMove = useCallback((x, y) => {
    const els = document.querySelectorAll('[data-selectable]');
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      const hit = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      el.classList.toggle('cursor-hover', hit);
    });
  }, []);

  const handleCursorClick = useCallback((x, y) => {
    const el = document.elementFromPoint(x, y);
    if (el) el.click();
  }, []);

  const handleScrollDelta = useCallback((dy) => {
    const scrollable = document.querySelector('.se-body') || document.querySelector('.se-tab-content');
    if (scrollable) scrollable.scrollTop += dy;
  }, []);

  const handleDragStart = useCallback((x, y) => {
    setDragging(true);
    setFramePos((prev) => {
      const cur = prev || { x: 0, y: 0 };
      dragRef.current = { startX: x, startY: y, origX: cur.x, origY: cur.y };
      return cur;
    });
  }, []);

  const handleDragMove = useCallback((x, y) => {
    const d = dragRef.current;
    const stage = document.querySelector('#frame-stage')?.getBoundingClientRect();
    const stageW = stage?.width ?? window.innerWidth;
    const stageH = stage?.height ?? window.innerHeight - 100;
    const margin = 60;
    const maxX = Math.max(0, (stageW / 2) - margin);
    const maxY = Math.max(0, (stageH / 2) - margin);
    const rawX = d.origX + (x - d.startX);
    const rawY = d.origY + (y - d.startY);
    setFramePos({
      x: Math.max(-maxX, Math.min(maxX, rawX)),
      y: Math.max(-maxY, Math.min(maxY, rawY)),
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    const engine = createEngine(
      {
        video: videoRef.current,
        canvas: canvasRef.current,
        cursor: cursorRef.current,
        ring: ringRef.current,
        ringArc: ringArcRef.current,
      },
      {
        onHudChange: setHudInfo,
        onStatusChange: setStatus,
        onToast: showToast,
        onLoadProgress: (pct, text) => { setLoadPct(pct); setLoadText(text); },
        onReady: () => setLoading(false),
        onHandLandmarks: setHandLandmarks,
        onDismissHome: () => setHomeScreen(false),
        onCreateFrame: handleCreateFrame,
        onResizeFrame: handleResizeFrame,
        onToggleStyleEditor: handleToggleStyleEditor,
        onCursorMove: handleCursorMove,
        onCursorClick: handleCursorClick,
        onScrollDelta: handleScrollDelta,
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragEnd: handleDragEnd,
        onDeleteFrame: handleDeleteFrame,
      },
    );
    engineRef.current = engine;
    engine.init();
    return () => engine.destroy();
  }, [showToast, handleCreateFrame, handleResizeFrame, handleDeleteFrame,
      handleToggleStyleEditor,
      handleCursorMove, handleCursorClick, handleScrollDelta,
      handleDragStart, handleDragMove, handleDragEnd]);

  return (
    <>
      <AsciiCloudHome visible={homeScreen} loading={loading} handLandmarks={handLandmarks} />
      <LoadingScreen pct={loadPct} text={loadText} visible={loading} />

      <video ref={videoRef} id="video" autoPlay playsInline muted style={{ opacity: homeScreen ? 0 : 0.25 }} />
      <canvas ref={canvasRef} id="hand-canvas" />

      {/* Style Editor — left panel */}
      <StyleEditor
        visible={editorOpen && !homeScreen}
        styles={selectedComponent ? { ...styles, ...(componentStyles[selectedComponent] || {}) } : styles}
        selectedComponent={selectedComponent}
        onStyleChange={handleStyleChange}
        onClose={() => setEditorOpen(false)}
      />

      {/* Design Frame */}
      {!homeScreen && frameVisible && (
        <div id="frame-stage" className={editorOpen ? 'shifted' : ''}>
          <DesignFrame
            breakpoint={breakpoint}
            styles={styles}
            componentStyles={componentStyles}
            selectedComponent={selectedComponent}
            onSelectComponent={setSelectedComponent}
            framePos={framePos}
            dragging={dragging}
          />
        </div>
      )}

      {/* Hold Ring */}
      <div ref={ringRef} className="hold-ring" id="ring-r">
        <svg width="64" height="64">
          <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(240,240,236,0.07)" strokeWidth="1.5" />
          <circle
            ref={ringArcRef}
            cx="32" cy="32" r="27"
            fill="none"
            stroke="rgba(240,240,236,0.9)"
            strokeWidth="1.5"
            strokeDasharray="169.6"
            strokeDashoffset="169.6"
          />
        </svg>
      </div>

      {/* Hand Cursor */}
      <div ref={cursorRef} className="hand-cursor" id="cursor-r" />

      <Toast msg={toast.msg} visible={toast.visible} />

      {!homeScreen && (
        <>
          <TopBar
            hudInfo={hudInfo}
            breakpoint={breakpoint}
            frameVisible={frameVisible}
            workflowId={workflowId}
            pullBusy={syncBusy.pull}
            pushBusy={syncBusy.push}
            onPullFromFigma={handlePullFromFigma}
            onPushToFigma={handlePushToFigma}
          />
          <StatusBar status={status} breakpoint={breakpoint} frameVisible={frameVisible} />
          <Legend />
        </>
      )}
    </>
  );
}
