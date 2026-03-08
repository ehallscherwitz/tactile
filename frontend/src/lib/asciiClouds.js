// Simplex noise (2D) — compact implementation
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

function buildPerm(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed | 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) & 0x7fffffff;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  const permGrad = new Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permGrad[i] = GRAD[perm[i] % 8];
  }
  return { perm, permGrad };
}

function noise2D(x, y, perm, permGrad) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s), j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t), y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;

  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { t0 *= t0; const g = permGrad[ii + perm[jj]]; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { t1 *= t1; const g = permGrad[ii + i1 + perm[jj + j1]]; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { t2 *= t2; const g = permGrad[ii + 1 + perm[jj + 1]]; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }

  return 70 * (n0 + n1 + n2);
}

// 6 octaves for detailed cloud edges
function fbm(x, y, perm, permGrad, octaves = 6) {
  let val = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < octaves; o++) {
    val += amp * noise2D(x * freq, y * freq, perm, permGrad);
    amp *= 0.5;
    freq *= 2.0;
  }
  return val;
}

// Hand skeleton connections
const HAND_CONN = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

const JOINT_RADIUS = new Float32Array(21);
JOINT_RADIUS[0] = 22;
JOINT_RADIUS[1] = 14; JOINT_RADIUS[2] = 11; JOINT_RADIUS[3] = 9; JOINT_RADIUS[4] = 8;
JOINT_RADIUS[5] = 14; JOINT_RADIUS[6] = 10; JOINT_RADIUS[7] = 8; JOINT_RADIUS[8] = 7;
JOINT_RADIUS[9] = 13; JOINT_RADIUS[10] = 9; JOINT_RADIUS[11] = 7; JOINT_RADIUS[12] = 6;
JOINT_RADIUS[13] = 12; JOINT_RADIUS[14] = 8; JOINT_RADIUS[15] = 7; JOINT_RADIUS[16] = 6;
JOINT_RADIUS[17] = 12; JOINT_RADIUS[18] = 8; JOINT_RADIUS[19] = 7; JOINT_RADIUS[20] = 6;

const BONE_HALF_W = 7;

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function createAsciiCloudRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const { perm, permGrad } = buildPerm(42);
  const { perm: perm2, permGrad: permGrad2 } = buildPerm(137);
  const CELL = 8;
  let cols = 0, rows = 0;
  let timeOffset = 0;
  let running = true;
  let animId = null;

  let handLandmarks = [];
  let handScreenCoords = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.ceil(canvas.width / CELL) + 1;
    rows = Math.ceil(canvas.height / CELL) + 1;
  }

  function getCloudValue(col, row, t) {
    const nx = col * 0.018;
    const ny = row * 0.018;

    const base = fbm(nx + t, ny + t * 0.5, perm, permGrad, 6);
    const detail = fbm(nx * 2.5 + 50 + t * 0.3, ny * 2.5 + 50, perm2, permGrad2, 4) * 0.15;

    const cx = col / cols;
    const cy = row / rows;

    // Main cloud mass center-right
    const mainDist = Math.hypot(cx - 0.52, cy - 0.45);
    const mainCloud = Math.max(0, 1 - mainDist * 1.6) * 0.45;

    // Secondary body extending right/down
    const secDist = Math.hypot(cx - 0.72, cy - 0.52);
    const secCloud = Math.max(0, 1 - secDist * 2.0) * 0.3;

    // Upper-right wisp
    const w1Dist = Math.hypot(cx - 0.78, cy - 0.18);
    const w1 = Math.max(0, 1 - w1Dist * 3.0) * 0.18;

    // Lower-left patch
    const patchDist = Math.hypot(cx - 0.25, cy - 0.7);
    const patch = Math.max(0, 1 - patchDist * 2.8) * 0.12;

    // Extra wisps scattered around
    const w2Dist = Math.hypot(cx - 0.15, cy - 0.22);
    const w2 = Math.max(0, 1 - w2Dist * 4.0) * 0.13;

    const w3Dist = Math.hypot(cx - 0.88, cy - 0.38);
    const w3 = Math.max(0, 1 - w3Dist * 3.5) * 0.14;

    const w4Dist = Math.hypot(cx - 0.35, cy - 0.12);
    const w4 = Math.max(0, 1 - w4Dist * 4.5) * 0.1;

    const w5Dist = Math.hypot(cx - 0.6, cy - 0.82);
    const w5 = Math.max(0, 1 - w5Dist * 3.8) * 0.11;

    const w6Dist = Math.hypot(cx - 0.92, cy - 0.7);
    const w6 = Math.max(0, 1 - w6Dist * 4.2) * 0.1;

    return base + detail + mainCloud + secCloud + w1 + patch + w2 + w3 + w4 + w5 + w6;
  }

  function getHandDensity(px, py) {
    let best = 0;
    for (let h = 0; h < handScreenCoords.length; h++) {
      const pts = handScreenCoords[h];
      for (let j = 0; j < 21; j++) {
        const d = Math.hypot(px - pts[j].x, py - pts[j].y);
        const r = JOINT_RADIUS[j];
        if (d < r) best = Math.max(best, 1 - d / r);
      }
      for (let ci = 0; ci < HAND_CONN.length; ci++) {
        const [a, b] = HAND_CONN[ci];
        const d = distToSegment(px, py, pts[a].x, pts[a].y, pts[b].x, pts[b].y);
        if (d < BONE_HALF_W) best = Math.max(best, 1 - d / BONE_HALF_W);
      }
    }
    return best;
  }

  const BLUE = [75, 140, 210];

  function draw() {
    ctx.fillStyle = '#F0F5FA';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    handScreenCoords = [];
    const W = canvas.width, H = canvas.height;
    for (let h = 0; h < handLandmarks.length; h++) {
      const lm = handLandmarks[h];
      const pts = [];
      for (let j = 0; j < 21; j++) {
        pts.push({ x: (1 - lm[j].x) * W, y: lm[j].y * H });
      }
      handScreenCoords.push(pts);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = c * CELL;
        const py = r * CELL;

        const handDensity = handScreenCoords.length > 0 ? getHandDensity(px, py) : 0;

        const cr = BLUE[0];
        const cg = BLUE[1];
        const cb = BLUE[2];

        if (handDensity > 0.05) {
          const ch = handDensity > 0.6 ? 'x' : handDensity > 0.3 ? '+' : '\u00B7';
          const size = handDensity > 0.6 ? 18 : handDensity > 0.3 ? 13 : 7;
          const bold = handDensity > 0.5 ? 'bold ' : '';
          const alpha = 0.45 + handDensity * 0.5;
          ctx.font = `${bold}${size}px monospace`;
          ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${alpha.toFixed(2)})`;
          ctx.fillText(ch, px, py);
        } else {
          const v = getCloudValue(c, r, timeOffset);
          const cloudThreshold = 0.12;

          let ch, size, alpha, bold;

          if (v > cloudThreshold) {
            const intensity = Math.min(1, (v - cloudThreshold) * 2.0);
            if (intensity > 0.6) {
              ch = '\u00B7'; size = 7; bold = ''; alpha = 0.18;
            } else if (intensity > 0.25) {
              ch = '+'; size = 11; bold = ''; alpha = 0.28;
            } else {
              ch = '+'; size = 12; bold = ''; alpha = 0.38;
            }
          } else {
            const depth = Math.max(0, (cloudThreshold - v) * 4);
            if (depth > 0.5) {
              ch = 'x'; size = 16; bold = 'bold '; alpha = 0.85;
            } else if (depth > 0.2) {
              ch = '+'; size = 13; bold = 'bold '; alpha = 0.7;
            } else {
              ch = '+'; size = 12; bold = ''; alpha = 0.55;
            }
          }

          ctx.font = `${bold}${size}px monospace`;
          ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${alpha.toFixed(2)})`;
          ctx.fillText(ch, px, py);
        }
      }
    }
  }

  function animate() {
    if (!running) return;
    timeOffset += 0.0003;
    draw();
    animId = requestAnimationFrame(animate);
  }

  function setHandLandmarks(landmarks) {
    handLandmarks = landmarks || [];
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
    running = true;
    animate();
  }

  function stop() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
  }

  return { start, stop, setHandLandmarks, resize };
}
