import { describe, it, expect, beforeEach } from 'vitest';
import { Injector } from '@angular/core';
import { PrivacyService } from './privacy.service';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let privacy: PrivacyService;

  beforeEach(() => {
    localStorage.clear();
    const injector = Injector.create({
      providers: [PrivacyService, StorageService],
    });
    service = injector.get(StorageService);
    privacy = injector.get(PrivacyService);
    privacy.enabled.set(false);
  });

  describe('get', () => {
    it('should return null for non-existent key', () => {
      expect(service.get('nonexistent')).toBeNull();
    });

    it('should return parsed value for existing key', () => {
      localStorage.setItem('test', JSON.stringify({ name: 'INES' }));
      const result = service.get<{ name: string }>('test');
      expect(result).toEqual({ name: 'INES' });
    });

    it('should return null for invalid JSON', () => {
      localStorage.setItem('bad', '{invalid}');
      expect(service.get('bad')).toBeNull();
    });
  });

  describe('set', () => {
    it('should store serialized value', () => {
      service.set('key1', { id: 1, label: 'test' });
      const raw = localStorage.getItem('key1');
      expect(JSON.parse(raw!)).toEqual({ id: 1, label: 'test' });
    });

    it('should overwrite existing value', () => {
      service.set('key1', 'first');
      service.set('key1', 'second');
      const raw = localStorage.getItem('key1');
      expect(JSON.parse(raw!)).toBe('second');
    });
  });

  describe('remove', () => {
    it('should remove existing key', () => {
      localStorage.setItem('key1', 'value');
      service.remove('key1');
      expect(localStorage.getItem('key1')).toBeNull();
    });

    it('should not throw for non-existent key', () => {
      expect(() => service.remove('nonexistent')).not.toThrow();
    });
  });
});
