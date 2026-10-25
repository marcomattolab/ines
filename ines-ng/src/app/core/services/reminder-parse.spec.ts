import { describe, it, expect } from 'vitest';
import { parseReminder } from './reminder-parse';

const HOUR = 3_600_000;
const MIN = 60_000;

describe('reminder-parse — parseReminder', () => {
  it('parses "in 1 hour"', () => {
    const now = Date.now();
    const p = parseReminder('remind me to call John in 1 hour', now)!;
    expect(p.message).toBe('call John');
    expect(p.at - now).toBeGreaterThan(HOUR - 1000);
    expect(p.at - now).toBeLessThan(HOUR + 1000);
  });

  it('parses "tra 30 minuti"', () => {
    const now = Date.now();
    const p = parseReminder('ricordami di pagare la bolletta tra 30 minuti', now)!;
    expect(p.message).toBe('pagare la bolletta');
    expect(p.at - now).toBeGreaterThan(30 * MIN - 1000);
    expect(p.at - now).toBeLessThan(30 * MIN + 1000);
  });

  it('handles time before the message', () => {
    const now = Date.now();
    const p = parseReminder('remind me in 10 minutes to call', now)!;
    expect(p.message).toBe('call');
    expect(p.at - now).toBeGreaterThan(10 * MIN - 1000);
  });

  it('parses a clock time "at 5pm"', () => {
    const p = parseReminder('remind me to buy milk at 5pm')!;
    expect(p.message).toBe('buy milk');
    expect(new Date(p.at).getHours()).toBe(17);
  });

  it('parses "alle 17:30" with no explicit message', () => {
    const p = parseReminder('promemoria alle 17:30')!;
    expect(p.message).toBe('Reminder');
    expect(new Date(p.at).getHours()).toBe(17);
    expect(new Date(p.at).getMinutes()).toBe(30);
  });

  it('returns null when no time is given', () => {
    expect(parseReminder('remind me to call John')).toBeNull();
  });
});
