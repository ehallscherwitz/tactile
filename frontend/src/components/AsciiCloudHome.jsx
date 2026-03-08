import { useRef, useEffect } from 'react';
import { createAsciiCloudRenderer } from '../lib/asciiClouds';

export default function AsciiCloudHome({ visible, handLandmarks }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    const renderer = createAsciiCloudRenderer(canvasRef.current);
    rendererRef.current = renderer;
    renderer.start();
    return () => renderer.stop();
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setHandLandmarks(handLandmarks);
    }
  }, [handLandmarks]);

  return (
    <div
      id="ascii-home"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <canvas ref={canvasRef} id="ascii-canvas" />
      <div className="ascii-bottom-fade" aria-hidden="true" />
      <div id="ascii-overlay">
        <div className="ascii-wordmark" data-text="tactile">tactile</div>
        <div className="ascii-tagline">design something soulful</div>
      </div>
      <div className="ascii-instruction-wrap">
        <div className="ascii-instruction">hold 2 fingers up to continue</div>
      </div>
    </div>
  );
}
