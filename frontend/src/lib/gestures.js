// Finger extension check (y increases downward in MediaPipe normalized coords)
export function extFingers(lm) {
  return [
    lm[8].y  < lm[6].y,   // index
    lm[12].y < lm[10].y,  // middle
    lm[16].y < lm[14].y,  // ring
    lm[20].y < lm[18].y,  // pinky
  ];
}

// Thumb is extended (tip clearly separated from palm)
export function isThumbExt(lm) {
  return Math.hypot(lm[4].x - lm[5].x, lm[4].y - lm[5].y) > 0.06;
}

// ── PINCH: thumb tip + index tip touching ───────────
// Unique spatial signature — no other gesture brings two tips together.
export function isPinch(lm) {
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) < 0.06;
}

// ── POINT: only index finger up ─────────────────────
// 1 finger. Thumb must NOT be extended to avoid confusion with old L-shape.
export function isPoint(lm) {
  const [i, m, r, p] = extFingers(lm);
  return i && !m && !r && !p && !isThumbExt(lm);
}

// ── PEACE: index + middle up ────────────────────────
// 2 fingers. Distinct finger count from point (1) and palm (5).
export function isPeace(lm) {
  const [i, m, r, p] = extFingers(lm);
  return i && m && !r && !p;
}

// ── THUMBS UP: only thumb extended ──────────────────
// Opposite side of hand from index — structurally impossible to confuse.
export function isThumbUp(lm) {
  const [i, m, r, p] = extFingers(lm);
  return !i && !m && !r && !p && isThumbExt(lm);
}

// ── OPEN PALM: all fingers extended ─────────────────
// 5 fingers. Maximum extension — unmistakable.
export function isOpenPalm(lm) {
  const [i, m, r, p] = extFingers(lm);
  return i && m && r && p;
}

// ── ROCK/HORNS: index + pinky up, middle + ring down ─
// 2 fingers but WHICH two — completely distinct from Peace (index+middle).
export function isRock(lm) {
  const [i, m, r, p] = extFingers(lm);
  return i && !m && !r && p;
}

// ── FIST: all fingers curled, thumb tucked ──────────
// 0 fingers. Minimum extension — opposite of open palm.
export function isFist(lm) {
  const [i, m, r, p] = extFingers(lm);
  return !i && !m && !r && !p && !isThumbExt(lm);
}

// Classification priority: pinch first (special spatial check),
// then rock before peace (both 2 fingers, but different pattern).
export function classifyGesture(lm) {
  if (isPinch(lm))    return 'pinch';     // tips touching — unique
  if (isFist(lm))     return 'fist';      // 0 fingers
  if (isThumbUp(lm))  return 'thumb';     // 1 thumb only
  if (isPoint(lm))    return 'point';     // 1 index only
  if (isRock(lm))     return 'rock';      // 2 fingers (index+pinky)
  if (isPeace(lm))    return 'peace';     // 2 fingers (index+middle)
  if (isOpenPalm(lm)) return 'open';      // 5 fingers
  return 'neutral';
}
