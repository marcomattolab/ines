import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { JsonParserService } from './json-parser.service';

describe('JsonParserService', () => {
  let service: JsonParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [JsonParserService],
    });
    service = TestBed.inject(JsonParserService);
  });

  describe('parse', () => {
    it('parses direct JSON object and array', () => {
      expect(service.parse('{"title": "test", "count": 42}')).toEqual({
        title: 'test',
        count: 42,
      });
      expect(service.parse('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('extracts JSON from markdown code block', () => {
      const markdown = `
Here is your JSON response:
\`\`\`json
{
  "name": "INES",
  "active": true
}
\`\`\`
Hope this helps!`;
      expect(service.parse(markdown)).toEqual({
        name: 'INES',
        active: true,
      });
    });

    it('repairs JSON with trailing commas', () => {
      const invalidJson = '{"a": 1, "b": 2, }';
      expect(service.parse(invalidJson)).toEqual({ a: 1, b: 2 });
    });

    it('repairs JSON with unquoted keys', () => {
      const invalidJson = '{name: "test", count: 10}';
      expect(service.parse(invalidJson)).toEqual({ name: 'test', count: 10 });
    });

    it('returns null for unparseable input', () => {
      expect(service.parse('just plain text')).toBeNull();
      expect(service.parse('')).toBeNull();
    });
  });

  describe('parseArray', () => {
    it('returns array when parsed successfully', () => {
      expect(service.parseArray('["apple", "banana"]')).toEqual(['apple', 'banana']);
    });

    it('returns empty array when JSON is not an array', () => {
      expect(service.parseArray('{"key": "value"}')).toEqual([]);
      expect(service.parseArray('invalid')).toEqual([]);
    });
  });

  describe('parseObject', () => {
    it('returns object when parsed successfully', () => {
      expect(service.parseObject('{"success": true}')).toEqual({ success: true });
    });

    it('returns null when JSON is an array or invalid', () => {
      expect(service.parseObject('[1, 2, 3]')).toBeNull();
      expect(service.parseObject('not json')).toBeNull();
    });
  });
});
