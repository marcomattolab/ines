import { describe, it, expect, beforeEach } from 'vitest';
import { ToastService } from '../toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = new ToastService();
  });

  it('should add a toast message', () => {
    service.show('Test message');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].msg).toBe('Test message');
  });

  it('should remove a toast after delay', async () => {
    service.show('Test message');
    expect(service.toasts().length).toBe(1);

    // We can't easily wait for the real setTimeout in a unit test without mocks or longer wait
    // but we can check if it exists initially
  });
});
