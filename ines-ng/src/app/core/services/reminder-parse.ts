/**
 * Pure, framework-free parsing of spoken reminders into (message, timestamp).
 * Supports durations ("in 1 hour", "tra 30 minuti") and clock times ("at 5pm", "alle 17:30").
 */

export interface ParsedReminder {
  message: string;
  /** Absolute timestamp in ms. */
  at: number;
}

const DURATION_RE =
  /(?:in|tra)\s+(\d+(?:[.,]\d+)?)\s*(secondo|secondi|minuto|minuti|ora|ore|giorno|giorni|second|seconds|minute|minutes|hour|hours|day|days)\b/i;
const HALF_HOUR_RE = /(?:mezz'ora|mezzora|half\s+an?\s+hour)\b/i;
const CLOCK_RE = /(?:at|alle)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

const UNIT_MS: Record<string, number> = {
  secondo: 1000,
  secondi: 1000,
  second: 1000,
  seconds: 1000,
  minuto: 60_000,
  minuti: 60_000,
  minute: 60_000,
  minutes: 60_000,
  ora: 3_600_000,
  ore: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  giorno: 86_400_000,
  giorni: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
};

const VERB_RE =
  /^\s*(remind\s+me\s+to|remind\s+me|ricordami\s+di|ricordami|ricordati\s+di|ricordati|promemoria|set\s+a\s+reminder|create\s+a\s+reminder)\b\s*/i;
const LEADING_TO_RE = /^\s*(to|di)\s+/i;

export function parseReminder(text: string, now = Date.now()): ParsedReminder | null {
  const clean = text.trim();
  if (!clean) return null;

  let at: number | null = null;
  let timeStart = -1;
  let timeEnd = -1;

  const duration = clean.match(DURATION_RE);
  const halfHour = clean.match(HALF_HOUR_RE);
  const clock = clean.match(CLOCK_RE);

  if (duration) {
    const n = parseFloat(duration[1].replace(',', '.'));
    const unit = duration[2].toLowerCase();
    at = now + n * (UNIT_MS[unit] ?? 0);
    timeStart = duration.index ?? 0;
    timeEnd = timeStart + duration[0].length;
  } else if (halfHour) {
    at = now + 30 * 60_000;
    timeStart = halfHour.index ?? 0;
    timeEnd = timeStart + halfHour[0].length;
  } else if (clock) {
    let h = parseInt(clock[1], 10);
    const mins = clock[2] ? parseInt(clock[2], 10) : 0;
    const ampm = clock[3]?.toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    const d = new Date(now);
    d.setHours(h, mins, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    at = d.getTime();
    timeStart = clock.index ?? 0;
    timeEnd = timeStart + clock[0].length;
  }

  if (at === null) return null;

  let message = (clean.slice(0, timeStart) + ' ' + clean.slice(timeEnd))
    .replace(VERB_RE, '')
    .replace(LEADING_TO_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!message) message = 'Reminder';

  return { message, at };
}
