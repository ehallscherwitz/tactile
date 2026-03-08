export default function LoadingScreen({ pct, text, visible }) {
  return (
    <div
      id="loading"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div className="loading-progress">
        <div id="load-sub">{text}</div>
        <div id="load-bar">
          <div id="load-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
