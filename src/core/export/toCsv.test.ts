import { describe, expect, it } from 'vitest';
import { toCsv } from './toCsv';

describe('toCsv', () => {
  it('empty rows produce an empty string', () => {
    expect(toCsv([])).toBe('');
  });

  it("header row from the first object's keys, then one row per object", () => {
    const csv = toCsv([
      { id: '1', title: 'Deep work' },
      { id: '2', title: 'Dinner' },
    ]);
    expect(csv).toBe('id,title\r\n1,Deep work\r\n2,Dinner');
  });

  it('quotes a value containing a comma, quote, or newline', () => {
    const csv = toCsv([{ note: 'a, b', quote: 'say "hi"', multi: 'line1\nline2' }]);
    expect(csv).toBe('note,quote,multi\r\n"a, b","say ""hi""","line1\nline2"');
  });

  it('stringifies nested objects/arrays as JSON', () => {
    const csv = toCsv([{ tags: ['a', 'b'], meta: { x: 1 } }]);
    expect(csv).toBe('tags,meta\r\n"[""a"",""b""]","{""x"":1}"');
  });

  it('null and undefined render as empty cells', () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }]);
    expect(csv).toBe('a,b,c\r\n,,0');
  });
});
