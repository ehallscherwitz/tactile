import { useState, useRef, useEffect, useCallback } from 'react';
import { createEngine } from './engine';
import { FONT_OPTIONS, COLOR_SCHEMES } from './lib/components';
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
          <TopBar hudInfo={hudInfo} breakpoint={breakpoint} frameVisible={frameVisible} />
          <StatusBar status={status} breakpoint={breakpoint} frameVisible={frameVisible} />
          <Legend />
        </>
      )}
    </>
  );
}
