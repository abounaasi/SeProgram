import path from 'path';
import { ParserError } from '../../src/parsers/ParserError';
import { JsonValue, parseJsonFile, parseJsonString } from '../../src/parsers/jsonParser';

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const bookOrdersPath = path.join(__dirname, '..', '..', 'src', 'data', 'book orders.json');

describe('parseJsonString', () => {
  describe('valid input', () => {
    it('parses an object', () => {
      expect(parseJsonString('{"id": "2001", "title": "Edge of Eternity"}')).toEqual({
        id: '2001',
        title: 'Edge of Eternity',
      });
    });

    it('preserves every JSON type without converting anything', () => {
      const result = parseJsonString(
        '{"text": "12", "integer": 12, "decimal": -4.5e2, "yes": true, "no": false, "nothing": null, "list": [1, "a"]}',
      );

      expect(result).toEqual({
        text: '12',
        integer: 12,
        decimal: -450,
        yes: true,
        no: false,
        nothing: null,
        list: [1, 'a'],
      });
    });

    it.each<[string, string, JsonValue]>([
      ['an array', '[1, 2]', [1, 2]],
      ['a string', '"hello"', 'hello'],
      ['a number', '42', 42],
      ['a boolean', 'false', false],
      ['null', 'null', null],
    ])('accepts %s at the top level', (_label, json, expected) => {
      expect(parseJsonString(json)).toEqual(expected);
    });

    it('decodes escape sequences and unicode', () => {
      expect(parseJsonString('{"quote": "say \\"hi\\"", "accent": "caf\\u00e9"}')).toEqual({
        quote: 'say "hi"',
        accent: 'café',
      });
    });
  });

  describe('nested data', () => {
    it('preserves nested objects and arrays at any depth', () => {
      const json = JSON.stringify({
        store: {
          name: 'Book Hub',
          orders: [
            { id: 1, items: [{ title: 'A', tags: ['new', 'signed'] }] },
            { id: 2, items: [] },
          ],
          address: { city: 'Amman', geo: { lat: 31.95, lng: 35.91 } },
        },
      });

      expect(parseJsonString(json)).toEqual(JSON.parse(json));
    });
  });

  describe('missing or optional fields', () => {
    it('keeps records with different keys exactly as they are', () => {
      const result = parseJsonString('[{"id": 1, "publisher": "Oxford"}, {"id": 2}]');

      expect(result).toEqual([{ id: 1, publisher: 'Oxford' }, { id: 2 }]);
    });

    it('keeps null and empty values distinct', () => {
      expect(parseJsonString('{"a": null, "b": "", "c": [], "d": {}}')).toEqual({ a: null, b: '', c: [], d: {} });
    });
  });

  describe('empty input', () => {
    it.each([
      ['an empty string', ''],
      ['only whitespace', ' \n\t '],
    ])('throws for %s', (_label, json) => {
      expect(() => parseJsonString(json)).toThrow(new ParserError('json', 'input is empty'));
    });
  });

  describe('malformed input', () => {
    it.each([
      ['a trailing comma', '{"a": 1,}'],
      ['single quotes', "{'a': 1}"],
      ['an unquoted key', '{a: 1}'],
      ['a missing closing bracket', '[1, 2'],
      ['a comment', '{"a": 1 // note\n}'],
      ['plain text', 'hello'],
      ['two values', '{} {}'],
    ])('throws a ParserError for %s', (_label, json) => {
      expect(() => parseJsonString(json)).toThrow(ParserError);
      expect(() => parseJsonString(json)).toThrow(/^JSON parser: invalid JSON: /);
    });

    it('keeps the original SyntaxError as the cause', () => {
      try {
        parseJsonString('{"a": 1,}');
        throw new Error('expected parseJsonString to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ParserError);
        expect((error as ParserError).cause).toBeInstanceOf(SyntaxError);
      }
    });
  });
});

describe('parseJsonFile', () => {
  it('parses the real book orders file', async () => {
    const result = await parseJsonFile(bookOrdersPath);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(350);
    expect((result as JsonValue[])[0]).toEqual({
      'Order ID': '2001',
      'Book Title': 'Edge of Eternity',
      Author: 'Dan Brown',
      Genre: 'Science Fiction',
      Format: 'Paperback',
      Language: 'French',
      Publisher: 'Oxford Press',
      'Special Edition': 'Signed Copy',
      Packaging: 'Eco-Friendly Packaging',
      Price: '12',
      Quantity: '5',
    });
  });

  it('gives every order in the real file the same 11 fields', async () => {
    const orders = (await parseJsonFile(bookOrdersPath)) as Record<string, JsonValue>[];
    const expectedKeys = Object.keys(orders[0]);

    expect(expectedKeys).toHaveLength(11);
    for (const order of orders) {
      expect(Object.keys(order)).toEqual(expectedKeys);
    }
  });

  it('throws for an empty file and names the file', async () => {
    const filePath = path.join(fixturesDir, 'empty.json');

    await expect(parseJsonFile(filePath)).rejects.toThrow(`JSON parser: input is empty (file: ${filePath})`);
  });

  it('throws for a malformed file and names the file', async () => {
    const filePath = path.join(fixturesDir, 'malformed.json');

    await expect(parseJsonFile(filePath)).rejects.toMatchObject({ format: 'json', filePath });
    await expect(parseJsonFile(filePath)).rejects.toThrow(/^JSON parser: invalid JSON: /);
  });

  it('throws for a missing file', async () => {
    const filePath = path.join(fixturesDir, 'missing.json');

    await expect(parseJsonFile(filePath)).rejects.toThrow(`JSON parser: file not found (file: ${filePath})`);
  });
});
