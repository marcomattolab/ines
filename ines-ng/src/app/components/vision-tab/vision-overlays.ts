/**
 * Pure canvas overlay helpers extracted from VisionTabComponent.
 * These functions only draw on a 2D context given landmark data, so they are
 * easy to unit-test and keep the component focused on orchestration.
 */

export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17],
];

// Pose skeleton connections (33 landmarks)
export const POSE_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 23],
  [12, 24],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  [29, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
  [30, 32],
];

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Draws hand-skeleton bones + joints for every detected hand. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawHandSkeleton(ctx: CanvasRenderingContext2D, hands: any[][]): void {
  if (!hands.length) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  for (let hi = 0; hi < hands.length; hi++) {
    const lm = hands[hi];
    if (!lm || lm.length < 21) continue;

    // Bones
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
    ctx.lineWidth = 2;
    for (const [i, j] of HAND_CONNECTIONS) {
      const a = lm[i],
        b = lm[j];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo((1 - a.x) * w, a.y * h);
      ctx.lineTo((1 - b.x) * w, b.y * h);
      ctx.stroke();
    }

    // Joint dots
    ctx.fillStyle = 'rgba(0, 255, 136, 0.9)';
    for (const p of lm) {
      if (!p) continue;
      ctx.beginPath();
      ctx.arc((1 - p.x) * w, p.y * h, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Draws the body-pose skeleton (33 landmarks). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawPoseSkeleton(ctx: CanvasRenderingContext2D, pose: any[]): void {
  if (!pose || pose.length < 33) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
  ctx.lineWidth = 2;
  for (const [i, j] of POSE_CONNECTIONS) {
    const a = pose[i],
      b = pose[j];
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo((1 - a.x) * w, a.y * h);
    ctx.lineTo((1 - b.x) * w, b.y * h);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
  for (const p of pose) {
    if (!p) continue;
    ctx.beginPath();
    ctx.arc((1 - p.x) * w, p.y * h, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
