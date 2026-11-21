import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';
import { SettingsService } from './settings.service';

describe('ToastService', () => {
  let service: ToastService;
  let settings: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ToastService, SettingsService] });
    service = TestBed.inject(ToastService);
    settings = TestBed.inject(SettingsService);
  });

  it('should add a toast message', () => {
    service.show('Test message');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].msg).toBe('Test message');
  });

  it('translates known messages when the language is Italian', () => {
    settings.lang.set('it-IT');
    service.show('Load the model first!');
    expect(service.toasts()[0].msg).toBe('Carica prima il modello!');
  });

  it('keeps English messages untranslated when the language is English', () => {
    settings.lang.set('en-US');
    service.success('Copied!');
    expect(service.toasts()[0].msg).toBe('Copied!');
  });

  it('translates interpolated messages', () => {
    settings.lang.set('it-IT');
    service.success('Imported 3 messages');
    expect(service.toasts()[0].msg).toBe('Importati 3 messaggi');
  });
});
