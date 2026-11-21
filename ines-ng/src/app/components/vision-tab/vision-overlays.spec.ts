import { describe, it, expect, vi } from 'vitest';
import { drawHandSkeleton, drawPoseSkeleton, roundRect } from './vision-overlays';

function mockCtx() {
  return {
    canvas: { width: 320, height: 240 },
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    quadraticCurveTo: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function hand(points = 21) {
  return Array.from({ length: points }, (_, i) => ({ x: i / points, y: 0.5 }));
}

function pose(points = 33) {
  return Array.from({ length: points }, (_, i) => ({ x: i / points, y: 0.5 }));
}

describe('vision-overlays — roundRect', () => {
  it('draws a rounded rectangle path', () => {
    const ctx = mockCtx();
    roundRect(ctx, 0, 0, 100, 50, 8);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(4);
    expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(4);
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

describe('vision-overlays — drawHandSkeleton', () => {
  it('does nothing when no hands are present', () => {
    const ctx = mockCtx();
    drawHandSkeleton(ctx, []);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws bones and joints for a valid hand', () => {
    const ctx = mockCtx();
    drawHandSkeleton(ctx, [hand(21)]);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledTimes(21);
  });
});

describe('vision-overlays — drawPoseSkeleton', () => {
  it('does nothing for an incomplete pose', () => {
    const ctx = mockCtx();
    drawPoseSkeleton(ctx, pose(20));
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws the pose skeleton for 33 landmarks', () => {
    const ctx = mockCtx();
    drawPoseSkeleton(ctx, pose(33));
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledTimes(33);
  });
});
