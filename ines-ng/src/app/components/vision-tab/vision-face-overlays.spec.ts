import { describe, it, expect, vi } from 'vitest';
import {
  drawAlienOverlay,
  drawCatOverlay,
  drawGokuOverlay,
  drawHairSpike,
  drawJokerOverlay,
  drawNinjaOverlay,
  drawPacmanOverlay,
  drawRobotOverlay,
  drawSkullOverlay,
  drawSunglassesOverlay,
  getOverlayTransform,
} from './vision-face-overlays';

function faceLm(): { x: number; y: number }[] {
  const arr: { x: number; y: number }[] = [];
  arr[10] = { x: 0.5, y: 0.2 }; // forehead
  arr[152] = { x: 0.5, y: 0.8 }; // chin
  arr[33] = { x: 0.4, y: 0.3 }; // left eye
  arr[362] = { x: 0.6, y: 0.3 }; // right eye
  arr[234] = { x: 0.35, y: 0.5 }; // left cheek
  arr[454] = { x: 0.65, y: 0.5 }; // right cheek
  return arr;
}

function mockCtx() {
  return {
    canvas: { width: 320, height: 240 },
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('vision-face-overlays — getOverlayTransform', () => {
  it('returns null when any required landmark is missing', () => {
    expect(getOverlayTransform([], 100, 200)).toBeNull();
    const partial = faceLm();
    delete partial[454];
    expect(getOverlayTransform(partial, 100, 200)).toBeNull();
  });

  it('computes center, rotation and face dimensions', () => {
    const t = getOverlayTransform(faceLm(), 100, 200);
    expect(t).not.toBeNull();
    expect(t!.cx).toBeCloseTo(50);
    expect(t!.cy).toBeCloseTo(100);
    expect(t!.rot).toBeCloseTo(0);
    expect(t!.faceW).toBeCloseTo(30);
    expect(t!.faceH).toBeCloseTo(120);
  });
});

describe('vision-face-overlays — drawHairSpike', () => {
  it('draws a filled triangle', () => {
    const ctx = mockCtx();
    drawHairSpike(ctx, 10, 20, 0, 0.1);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe('vision-face-overlays — overlays', () => {
  it('returns early (no drawing) when the transform is unavailable', () => {
    const ctx = mockCtx();
    drawPacmanOverlay(ctx, [], 100, 100);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it.each([
    ['pacman', drawPacmanOverlay],
    ['goku', drawGokuOverlay],
    ['cat', drawCatOverlay],
    ['robot', drawRobotOverlay],
    ['alien', drawAlienOverlay],
    ['ninja', drawNinjaOverlay],
    ['joker', drawJokerOverlay],
    ['sunglasses', drawSunglassesOverlay],
    ['skull', drawSkullOverlay],
  ] as const)('%s draws on a valid face', (_name, draw) => {
    const ctx = mockCtx();
    draw(ctx, faceLm(), 320, 240);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});
