/**
 * Canvas-drawn "icon face" overlays extracted from VisionTabComponent.
 * These are pure functions of (ctx, landmarks, width, height) — the component
 * only supplies the face transform computed from the landmarks.
 */
import { roundRect } from './vision-overlays';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Landmarks = any[];

export function getOverlayTransform(
  lm: Landmarks,
  w: number,
  h: number,
): { cx: number; cy: number; rot: number; faceW: number; faceH: number } | null {
  const forehead = lm[10],
    chin = lm[152],
    lEye = lm[33],
    rEye = lm[362];
  const leftCheek = lm[234],
    rightCheek = lm[454];
  if (!forehead || !chin || !lEye || !rEye || !leftCheek || !rightCheek) return null;
  return {
    cx: ((leftCheek.x + rightCheek.x) / 2) * w,
    cy: ((forehead.y + chin.y) / 2) * h,
    rot: Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x),
    faceW: Math.abs(rightCheek.x - leftCheek.x) * w,
    faceH: Math.abs(chin.y - forehead.y) * h,
  };
}

export function drawHairSpike(
  ctx: CanvasRenderingContext2D,
  baseR: number,
  tipR: number,
  angle: number,
  spread: number,
): void {
  ctx.beginPath();
  ctx.moveTo(Math.cos(angle - spread) * baseR, Math.sin(angle - spread) * baseR);
  ctx.lineTo(Math.cos(angle) * tipR, Math.sin(angle) * tipR);
  ctx.lineTo(Math.cos(angle + spread) * baseR, Math.sin(angle + spread) * baseR);
  ctx.closePath();
  ctx.fill();
}

export function drawPacmanOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmarks,
  w: number,
  h: number,
): void {
  const t = getOverlayTransform(lm, w, h);
  if (!t) return;
  const r = Math.max(t.faceW, t.faceH) * 0.65;
  const mouthAngle = (Math.sin(performance.now() / 200) * 0.3 + 0.4) * Math.PI;
  ctx.save();
  ctx.translate(t.cx, t.cy);
  ctx.rotate(t.rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, mouthAngle, Math.PI * 2 - mouthAngle);
  ctx.closePath();
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 2;
  ctx.stroke();
  const eyeX = r * 0.25,
    eyeY = -r * 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGokuOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmarks,
  w: number,
  h: number,
): void {
  const t = getOverlayTransform(lm, w, h);
  if (!t) return;
  const s = Math.max(t.faceW, t.faceH) * 0.8;
  ctx.save();
  ctx.translate(t.cx, t.cy);
  ctx.rotate(t.rot);

  // ---- Golden aura ----
  ctx.shadowBlur = 60;
  ctx.shadowColor = '#FFD700';
  ctx.fillStyle = 'rgba(255, 215, 0, 0.04)';
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ---- Hair base (solid gold mass) ----
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(0, -s * 0.1, s * 0.62, Math.PI * 0.1, Math.PI * 0.9, false);
  ctx.closePath();
  ctx.fill();

  // ---- Spiky hair in radial layers ----
  const hairColor = '#FFD700';
  const hlColor = '#FFC107';
  const darkColor = '#DAA520';

  // Back/side spikes (layer 1 — darker)
  ctx.fillStyle = darkColor;
  const sideAngles = [
    [0.55, 1.25],
    [0.65, 1.6],
    [0.5, 2.2],
    [0.5, -2.2],
    [0.65, -1.6],
    [0.55, -1.25],
  ];
  for (const [lenMul, angle] of sideAngles) {
    drawHairSpike(ctx, s * 0.55, s * 0.65 * lenMul, angle, 0.08);
  }

  // Middle spikes (layer 2 — main gold)
  ctx.fillStyle = hairColor;
  const midAngles = [-0.35, -0.2, 0, 0.2, 0.35];
  for (const a of midAngles) {
    drawHairSpike(ctx, s * 0.5, s * 0.78, -Math.PI / 2 + a, 0.06 + Math.abs(a) * 0.06);
  }

  // Top fringe (iconic Goku bangs — layer 3, brightest)
  ctx.fillStyle = hlColor;
  const fringe = [
    { angle: -0.45, len: 1.1 },
    { angle: -0.3, len: 1.25 },
    { angle: -0.15, len: 1.3 },
    { angle: 0.0, len: 1.35 },
    { angle: 0.15, len: 1.3 },
    { angle: 0.3, len: 1.2 },
    { angle: 0.45, len: 1.0 },
  ];
  for (const { angle, len } of fringe) {
    drawHairSpike(ctx, s * 0.42, s * 0.65 * len, -Math.PI / 2 + angle, 0.04);
  }

  // Small forehead spikes covering the hairline
  ctx.fillStyle = hairColor;
  for (let i = -0.6; i <= 0.6; i += 0.15) {
    drawHairSpike(ctx, s * 0.35, s * 0.5, -Math.PI / 2 + i, 0.05);
  }

  // ---- Round face (skin) ----
  ctx.fillStyle = '#F5D6B8';
  ctx.beginPath();
  ctx.arc(0, s * 0.04, s * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Subtle cheek color
  ctx.fillStyle = 'rgba(255, 180, 150, 0.15)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.25, s * 0.12, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.25, s * 0.12, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- Jaw line (soft, round) ----
  ctx.strokeStyle = '#E0B890';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, s * 0.05);
  ctx.quadraticCurveTo(-s * 0.48, s * 0.32, -s * 0.3, s * 0.48);
  ctx.quadraticCurveTo(0, s * 0.55, s * 0.3, s * 0.48);
  ctx.quadraticCurveTo(s * 0.48, s * 0.32, s * 0.42, s * 0.05);
  ctx.stroke();

  // ---- Eyebrows (thick, dark, slanted down toward center) ----
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.16);
  ctx.lineTo(-s * 0.1, -s * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.12);
  ctx.lineTo(s * 0.32, -s * 0.16);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // ---- Eyes (large, green-blue iris, Goku style) ----
  for (const side of [-1, 1]) {
    const ex = side * s * 0.18;
    const ey = -s * 0.03;

    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.ellipse(ex, ey, s * 0.08, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.09, Math.PI * 0.1, Math.PI * 0.9, false);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.09, Math.PI * 0.9, Math.PI * 0.1, true);
    ctx.stroke();

    ctx.fillStyle = '#3FBF7F';
    ctx.beginPath();
    ctx.ellipse(ex, ey, s * 0.05, s * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2E8B57';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(ex, ey, s * 0.048, s * 0.07, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.03, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(ex - s * 0.015, ey - s * 0.025, s * 0.018, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + s * 0.02, ey + s * 0.01, s * 0.008, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Nose (small, simple) ----
  ctx.strokeStyle = '#D4A070';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(s * 0.02, s * 0.02);
  ctx.lineTo(0, s * 0.07);
  ctx.lineTo(-s * 0.02, s * 0.02);
  ctx.stroke();
  ctx.fillStyle = '#C89060';
  ctx.beginPath();
  ctx.ellipse(-s * 0.015, s * 0.07, s * 0.01, s * 0.007, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.015, s * 0.07, s * 0.01, s * 0.007, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- Mouth (confident Goku smile) ----
  ctx.strokeStyle = '#B06060';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, s * 0.18);
  ctx.quadraticCurveTo(0, s * 0.22, s * 0.1, s * 0.18);
  ctx.stroke();
  ctx.fillStyle = 'rgba(180, 80, 80, 0.1)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.21, s * 0.08, s * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 100, 100, 0.15)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.11, s * 0.17, s * 0.015, s * 0.01, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.11, s * 0.17, s * 0.015, s * 0.01, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- Orange gi collar ----
  ctx.strokeStyle = '#E65100';
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.12);
  ctx.quadraticCurveTo(-s * 0.52, s * 0.38, 0, s * 0.52);
  ctx.quadraticCurveTo(s * 0.52, s * 0.38, s * 0.5, s * 0.12);
  ctx.stroke();

  ctx.strokeStyle = '#1565C0';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, s * 0.18);
  ctx.quadraticCurveTo(-s * 0.44, s * 0.38, 0, s * 0.48);
  ctx.quadraticCurveTo(s * 0.44, s * 0.38, s * 0.42, s * 0.18);
  ctx.stroke();
  ctx.lineCap = 'butt';

  ctx.restore();
}

export function drawCatOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmarks,
  w: number,
  h: number,
): void {
  const t = getOverlayTransform(lm, w, h);
  if (!t) return;
  const s = Math.max(t.faceW, t.faceH) * 0.65;
  ctx.save();
  ctx.translate(t.cx, t.cy - t.faceH * 0.05);
  ctx.rotate(t.rot);
  ctx.fillStyle = '#FF8C42';
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#CC6A2E';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Ears
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.5, -s * 0.1);
    ctx.lineTo(side * s * 0.9, -s * 0.85);
    ctx.lineTo(side * s * 0.1, -s * 0.55);
    ctx.closePath();
    ctx.fillStyle = '#FF8C42';
    ctx.fill();
    ctx.strokeStyle = '#CC6A2E';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Inner ear (pink)
    ctx.beginPath();
    ctx.moveTo(side * s * 0.45, -s * 0.15);
    ctx.lineTo(side * s * 0.75, -s * 0.65);
    ctx.lineTo(side * s * 0.2, -s * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#FFB6C1';
    ctx.fill();
  }
  // Eyes
  ctx.fillStyle = '#2D5A27';
  for (const ex of [-s * 0.25, s * 0.25]) {
    ctx.beginPath();
    ctx.ellipse(ex, -s * 0.1, s * 0.08, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ex, -s * 0.1, s * 0.04, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2D5A27';
  }
  // Nose
  ctx.fillStyle = '#FF69B4';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.12);
  ctx.lineTo(-s * 0.06, s * 0.18);
  ctx.lineTo(s * 0.06, s * 0.18);
  ctx.closePath();
  ctx.fill();
  // Whiskers
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 0.8;
  for (const side of [-1, 1]) {
    for (let wi = 0; wi < 3; wi++) {
      const wy = s * (0.12 + wi * 0.07);
      ctx.beginPath();
      ctx.moveTo(side * s * 0.08, wy);
      ctx.lineTo(side * s * 0.55, wy - s * 0.04 + wi * s * 0.03);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawRobotOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmarks,
  w: number,
  h: number,
): void {
  const t = getOverlayTransform(lm, w, h);
  if (!t) return;
  const s = Math.max(t.faceW, t.faceH) * 0.7;
  ctx.save();
  ctx.translate(t.cx, t.cy);
  ctx.rotate(t.rot);
  // Head (rounded rectangle)
  ctx.fillStyle = '#A0A0A0';
  const rw = s * 1.2,
    rh = s * 1.3;
  roundRect(ctx, -rw / 2, -rh / 2, rw, rh, s * 0.15);
  ctx.fill();
  ctx.strokeStyle = '#707070';
  ctx.lineWidth = 2;
  roundRect(ctx, -rw / 2, -rh / 2, rw, rh, s * 0.15);
  ctx.stroke();
  // Antenna
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -rh / 2);
  ctx.lineTo(0, -rh / 2 - s * 0.3);
  ctx.stroke();
  ctx.fillStyle = '#FF4444';
  ctx.beginPath();
  ctx.arc(0, -rh / 2 - s * 0.3, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  // LED eyes
  ctx.fillStyle = '#00FF88';
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#00FF88';
  for (const ex of [-s * 0.25, s * 0.25]) {
    ctx.beginPath();
    ctx.roundRect(ex - s * 0.1, -s * 0.15, s * 0.2, s * 0.12, s * 0.03);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Mouth grid
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  const my = s * 0.2;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      ctx.strokeRect(-s * 0.35 + col * s * 0.17, my + row * s * 0.12, s * 0.13, s * 0.08);
    }
  }
  ctx.restore();
}

export function drawAlienOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmarks,
  w: number,
  h: number,
): void {
  const t = getOverlayTransform(lm, w, h);
  if (!t) return;
  const s = Math.max(t.faceW, t.faceH) * 0.65;
  ctx.save();
  ctx.translate(t.cx, t.cy - t.faceH * 0.1);
  ctx.rotate(t.rot);
  ctx.fillStyle = '#7CCD7C';
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5B9E5B';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Antennae
  ctx.strokeStyle = '#7CCD7C';
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.35, -s * 0.45);
    ctx.quadraticCurveTo(side * s * 0.7, -s * 1.0, side * s * 0.5, -s * 1.1);
    ctx.stroke();
    ctx.fillStyle = '#FF69B4';
    ctx.beginPath();
    ctx.arc(side * s * 0.5, -s * 1.1, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  // Big black eyes
  ctx.fillStyle = '#000';
  for (const ex of [-s * 0.2, s * 0.2]) {
    ctx.beginPath();
    ctx.ellipse(ex, -s * 0.05, s * 0.15, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + s * 0.04, -s * 0.1, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
  }
  // Small mouth
  ctx.fillStyle = '#5B9E5B';
  ctx.beginPath();
  ctx.arc(0, s * 0.2, s * 0.06, 0, Math.PI);
  ctx.fill();
  ctx.restore();
}

export function drawNinjaOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmarks,
  w: number,
  h: number,
): void {
  const t = getOverlayTransform(lm, w, h);
  if (!t) return;
  const s = Math.max(t.faceW, t.faceH) * 0.65;
  ctx.save();
  ctx.translate(t.cx, t.cy);
  ctx.rotate(t.rot);
  // Face circle (dark mask)
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2d2d44';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Eye cutouts (white glow)
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#fff';
  for (const ex of [-s * 0.22, s * 0.22]) {
    ctx.beginPath();
    ctx.ellipse(ex, -s * 0.05, s * 0.1, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Pupils
  ctx.fillStyle = '#000';
  for (const ex of [-s * 0.22, s * 0.22]) {
    ctx.beginPath();
    ctx.arc(ex, -s * 0.05, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  // Headband
  ctx.fillStyle = '#C62828';
  ctx.fillRect(-s * 1.1, -s * 0.55, s * 2.2, s * 0.12);
  ctx.strokeStyle = '#B71C1C';
  ctx.lineWidth = 1;
  ctx.strokeRect(-s * 1.1, -s * 0.55, s * 2.2, s * 0.12);
  // Headband tail
  ctx.fillStyle = '#C62828';
  ctx.beginPath();
  ctx.moveTo(s * 0.8, -s * 0.55);
  ctx.quadraticCurveTo(s * 1.2, -s * 0.9, s * 0.7, -s * 1.0);
  ctx.lineTo(s * 0.6, -s * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawJokerOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmarks,
  w: number,
  h: number,
): void {
  const t = getOverlayTransform(lm, w, h);
  if (!t) return;
  const s = Math.max(t.faceW, t.faceH) * 0.65;
  ctx.save();
  ctx.translate(t.cx, t.cy - t.faceH * 0.02);
  ctx.rotate(t.rot);
  // Face (white base)
  ctx.fillStyle = '#F5F5DC';
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#CCC';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Green messy hair
  ctx.fillStyle = '#2E7D32';
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const r = s * 1.05;
    const hx = Math.cos(angle) * r,
      hy = Math.sin(angle) * r;
    if (hy < -s * 0.2) continue;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    const endX = hx + (Math.random() - 0.5) * s * 0.5;
    const endY = hy - s * 0.3 - Math.random() * s * 0.15;
    ctx.quadraticCurveTo((hx + endX) / 2, hy - s * 0.4, endX, endY);
    ctx.lineWidth = 4 + Math.random() * 3;
    ctx.stroke();
  }
  // Big red smile
  ctx.strokeStyle = '#C62828';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, s * 0.05, s * 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#B71C1C';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, s * 0.05, s * 0.45, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  // Teeth
  ctx.fillStyle = '#FFF';
  for (let tx = -s * 0.3; tx <= s * 0.3; tx += s * 0.1) {
    const ty = s * 0.05 + Math.sqrt(Math.max(0, (s * 0.45) ** 2 - tx ** 2));
    ctx.fillRect(tx - s * 0.03, ty - s * 0.03, s * 0.06, s * 0.06);
  }
  // Eyes (dark makeup)
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(-s * 0.22, -s * 0.1, s * 0.12, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.22, -s * 0.1, s * 0.12, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  // Red nose
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.arc(0, s * 0.08, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawSunglassesOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmarks,
  w: number,
  h: number,
): void {
  const t = getOverlayTransform(lm, w, h);
  if (!t) return;
  const s = Math.max(t.faceW, t.faceH) * 0.65;
  ctx.save();
  ctx.translate(t.cx, t.cy - t.faceH * 0.05);
  ctx.rotate(t.rot);
  // Two large lenses
  ctx.fillStyle = '#1a1a2e';
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(side * s * 0.32 - s * 0.28, -s * 0.22, s * 0.5, s * 0.3, s * 0.06);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Bridge
  ctx.fillStyle = '#333';
  ctx.fillRect(-s * 0.06, -s * 0.12, s * 0.12, s * 0.06);
  // Arms
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.07);
  ctx.lineTo(-s * 0.75, -s * 0.02);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.32, -s * 0.07);
  ctx.lineTo(s * 0.75, -s * 0.02);
  ctx.stroke();
  // Lens reflections
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(side * s * 0.32 - s * 0.2, -s * 0.17, s * 0.25, s * 0.08, s * 0.03);
    ctx.fill();
  }
  ctx.restore();
}

export function drawSkullOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmarks,
  w: number,
  h: number,
): void {
  const t = getOverlayTransform(lm, w, h);
  if (!t) return;
  const s = Math.max(t.faceW, t.faceH) * 0.65;
  ctx.save();
  ctx.translate(t.cx, t.cy);
  ctx.rotate(t.rot);
  // Skull shape
  ctx.fillStyle = '#F5F5F5';
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#CCC';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Jaw line
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, s * 0.1);
  ctx.quadraticCurveTo(-s * 0.75, s * 0.55, 0, s * 0.7);
  ctx.quadraticCurveTo(s * 0.75, s * 0.55, s * 0.7, s * 0.1);
  ctx.fill();
  ctx.stroke();
  // Eye sockets
  ctx.fillStyle = '#1a1a1a';
  for (const ex of [-s * 0.22, s * 0.22]) {
    ctx.beginPath();
    ctx.ellipse(ex, -s * 0.08, s * 0.16, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Nose hole
  ctx.beginPath();
  ctx.moveTo(0, s * 0.08);
  ctx.lineTo(-s * 0.05, s * 0.16);
  ctx.lineTo(s * 0.05, s * 0.16);
  ctx.closePath();
  ctx.fill();
  // Teeth
  ctx.fillStyle = '#E0E0E0';
  for (let row = 0; row < 2; row++) {
    for (let col = -3; col <= 3; col++) {
      if (col === 0 && row === 0) continue;
      const tx = col * s * 0.08;
      const ty = s * 0.28 + row * s * 0.1;
      ctx.fillRect(tx - s * 0.03, ty, s * 0.06, s * 0.08);
      ctx.strokeRect(tx - s * 0.03, ty, s * 0.06, s * 0.08);
    }
  }
  ctx.restore();
}
