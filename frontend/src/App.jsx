import { useState, useRef, useEffect, useCallback } from 'react';
import { createEngine } from './engine';
import TopBar from './components/TopBar';
import StatusBar from './components/StatusBar';
import Legend from './components/Legend';
import LoadingScreen from './components/LoadingScreen';
import AsciiCloudHome from './components/AsciiCloudHome';
import Toast from './components/Toast';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [homeScreen, setHomeScreen] = useState(true);
  const [loadPct, setLoadPct] = useState(0);
  const [loadText, setLoadText] = useState('Initializing…');
  const [cardCount, setCardCount] = useState(0);
  const [hudInfo, setHudInfo] = useState({ emoji: '✋', text: 'Show your hands to begin', active: false });
  const [toast, setToast] = useState({ msg: '', visible: false });
  const [status, setStatus] = useState({ cam: false, mp: false, hand: false, ws: false });
  const [handLandmarks, setHandLandmarks] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const cursorRef = useRef(null);
  const ghostRef = useRef(null);
  const ghostLabelRef = useRef(null);
  const ghostBodyRef = useRef(null);
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

  useEffect(() => {
    const engine = createEngine(
      {
        video: videoRef.current,
        canvas: canvasRef.current,
        stage: stageRef.current,
        cursor: cursorRef.current,
        ghost: ghostRef.current,
        ghostLabel: ghostLabelRef.current,
        ghostBody: ghostBodyRef.current,
        ring: ringRef.current,
        ringArc: ringArcRef.current,
      },
      {
        onHudChange: setHudInfo,
        onCardCountChange: setCardCount,
        onStatusChange: setStatus,
        onToast: showToast,
        onLoadProgress: (pct, text) => { setLoadPct(pct); setLoadText(text); },
        onReady: () => setLoading(false),
        onHandLandmarks: setHandLandmarks,
        onDismissHome: () => setHomeScreen(false),
      },
    );
    engineRef.current = engine;
    engine.init();
    return () => engine.destroy();
  }, [showToast]);

  return (
    <>
      <AsciiCloudHome visible={homeScreen} handLandmarks={handLandmarks} />
      <LoadingScreen pct={loadPct} text={loadText} visible={loading} />

      <video ref={videoRef} id="video" autoPlay playsInline muted style={{ opacity: homeScreen ? 0 : 0.35 }} />
      <canvas ref={canvasRef} id="hand-canvas" />

      <div ref={stageRef} id="stage" style={{ display: homeScreen ? 'none' : undefined }} />

      <div ref={ghostRef} id="ghost">
        <div ref={ghostLabelRef} id="ghost-label" />
        <div ref={ghostBodyRef} id="ghost-body" />
      </div>

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

      <div ref={cursorRef} className="hand-cursor" id="cursor-r" />

      <Toast msg={toast.msg} visible={toast.visible} />

      {!homeScreen && (
        <>
          <TopBar
            hudInfo={hudInfo}
            onClear={() => engineRef.current?.clearAll()}
            onSync={() => engineRef.current?.syncFigma()}
          />
          <StatusBar status={status} cardCount={cardCount} />
          <Legend />
        </>
      )}
    </>
  );
}
