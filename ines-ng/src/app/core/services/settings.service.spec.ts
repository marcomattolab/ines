import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SettingsService, StorageService],
    });
    service = TestBed.inject(SettingsService);
    storage = TestBed.inject(StorageService);
  });

  it('initializes with default values when localStorage is empty', () => {
    expect(service.hiddenTabs()).toEqual([]);
    expect(service.tabOrder()).toEqual([]);
    expect(service.lang()).toBe('en-US');
    expect(service.lightTheme()).toBe(false);
    expect(service.wakeOnStartup()).toBe(false);
  });

  it('determines visibility of tabs correctly', () => {
    expect(service.isVisible('chat')).toBe(true);
    service.toggle('chat');
    expect(service.isVisible('chat')).toBe(false);
    expect(service.hiddenTabs()).toContain('chat');
    service.toggle('chat');
    expect(service.isVisible('chat')).toBe(true);
    expect(service.hiddenTabs()).not.toContain('chat');
  });

  it('updates tab ordering and resets settings', () => {
    service.setOrder(['todo', 'chat', 'email']);
    expect(service.tabOrder()).toEqual(['todo', 'chat', 'email']);

    service.toggle('email');
    expect(service.hiddenTabs()).toContain('email');

    service.reset();
    expect(service.tabOrder()).toEqual([]);
    expect(service.hiddenTabs()).toEqual([]);
  });
});
