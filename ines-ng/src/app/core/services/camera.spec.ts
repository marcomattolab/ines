import { describe, it, expect, vi } from 'vitest';
import { clamp, errorMessage, frameLoop } from './camera';

describe('camera utilities', () => {
  describe('clamp', () => {
    it('clamps numbers within default [0, 1] range', () => {
      expect(clamp(0.5)).toBe(0.5);
      expect(clamp(-0.5)).toBe(0);
      expect(clamp(1.5)).toBe(1);
    });

    it('clamps numbers with custom min and max', () => {
      expect(clamp(5, 10, 20)).toBe(10);
      expect(clamp(15, 10, 20)).toBe(15);
      expect(clamp(25, 10, 20)).toBe(20);
    });
  });

  describe('errorMessage', () => {
    it('extracts message from Error object', () => {
      expect(errorMessage(new Error('Permission denied'))).toBe('Permission denied');
    });

    it('converts string and primitive values to string', () => {
      expect(errorMessage('Network error')).toBe('Network error');
      expect(errorMessage(404)).toBe('404');
      expect(errorMessage(null)).toBe('null');
    });
  });

  describe('frameLoop', () => {
    it('schedules callback via requestAnimationFrame and stops when cancelled', () => {
      let rafCount = 0;
      const fakeRaf = vi.fn((cb: FrameRequestCallback) => {
        rafCount++;
        return rafCount;
      });
      const fakeCancel = vi.fn();
      vi.stubGlobal('requestAnimationFrame', fakeRaf);
      vi.stubGlobal('cancelAnimationFrame', fakeCancel);

      const callback = vi.fn();
      const stop = frameLoop(callback);

      expect(fakeRaf).toHaveBeenCalled();
      stop();
      expect(fakeCancel).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
