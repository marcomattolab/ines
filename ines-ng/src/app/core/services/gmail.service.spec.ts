import { describe, it, expect } from 'vitest';
import { buildGmailQuery } from './gmail.service';

describe('buildGmailQuery', () => {
  it('defaults to the inbox', () => {
    expect(buildGmailQuery()).toBe('in:inbox');
  });

  it('appends labels as OR terms', () => {
    expect(buildGmailQuery(['scontrini', 'ricevute'])).toBe(
      'in:inbox OR label:"scontrini" OR label:"ricevute"',
    );
  });

  it('ignores empty labels and strips quotes', () => {
    expect(buildGmailQuery([' scontrini ', '', '"casa"'])).toBe(
      'in:inbox OR label:"scontrini" OR label:"casa"',
    );
  });
});
