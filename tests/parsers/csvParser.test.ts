import path from 'path';
import { ParserError } from '../../src/parsers/ParserError';
import { parseCsvFile, parseCsvString } from '../../src/parsers/csvParser';

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const cakeOrdersPath = path.join(__dirname, '..', '..', 'src', 'data', 'cake orders.csv');

describe('parseCsvString', () => {
  describe('valid input', () => {
    it('turns each row into an object keyed by the header', () => {
      const csv = 'id,Type,Price\n1,Sponge,50\n2,Chocolate,75\n';

      expect(parseCsvString(csv)).toEqual([
        { id: '1', Type: 'Sponge', Price: '50' },
        { id: '2', Type: 'Chocolate', Price: '75' },
      ]);
    });

    it('keeps every value as the exact string in the file', () => {
      const [record] = parseCsvString('code,amount,flag\n007,12.50,true\n');

      expect(record).toEqual({ code: '007', amount: '12.50', flag: 'true' });
    });

    it('handles quoted fields containing commas, escaped quotes and line breaks', () => {
      const csv = 'name,note\n"Smith, Anna","She said ""hi"""\n"Lee","line one\nline two"\n';

      expect(parseCsvString(csv)).toEqual([
        { name: 'Smith, Anna', note: 'She said "hi"' },
        { name: 'Lee', note: 'line one\nline two' },
      ]);
    });

    it('accepts Windows (CRLF) line endings', () => {
      expect(parseCsvString('a,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }]);
    });

    it('skips blank lines and works without a trailing newline', () => {
      expect(parseCsvString('a,b\n1,2\n\n3,4')).toEqual([
        { a: '1', b: '2' },
        { a: '3', b: '4' },
      ]);
    });
  });

  describe('missing or optional fields', () => {
    it('keeps an empty field as an empty string', () => {
      const [record] = parseCsvString('id,message\n1,""\n');

      expect(record).toEqual({ id: '1', message: '' });
    });

    it('returns an empty array for a header with no data rows', () => {
      expect(parseCsvString('id,Type,Price\n')).toEqual([]);
    });

    it('rejects a row with fewer columns than the header', () => {
      expect(() => parseCsvString('id,Type,Price\n1,Sponge\n')).toThrow(/Invalid Record Length/);
    });

    it('rejects a row with more columns than the header', () => {
      expect(() => parseCsvString('id,Type\n1,Sponge,extra\n')).toThrow(/Invalid Record Length/);
    });
  });

  describe('empty input', () => {
    it.each([
      ['an empty string', ''],
      ['only whitespace', '  \n\t\r\n'],
    ])('throws for %s', (_label, csv) => {
      expect(() => parseCsvString(csv)).toThrow(new ParserError('csv', 'input is empty'));
    });
  });

  describe('malformed input', () => {
    it('throws a ParserError for an unclosed quote', () => {
      expect(() => parseCsvString('a,b\n"1,2\n')).toThrow(ParserError);
      expect(() => parseCsvString('a,b\n"1,2\n')).toThrow(/CSV parser: invalid CSV: Quote Not Closed/);
    });

    it('throws for a duplicate header, which would otherwise silently overwrite a column', () => {
      expect(() => parseCsvString('id,Price,Price\n1,10,20\n')).toThrow(
        'CSV parser: invalid CSV: duplicate header column "Price"',
      );
    });

    it('throws for a header column without a name', () => {
      expect(() => parseCsvString('id,,Price\n1,x,10\n')).toThrow(
        'CSV parser: invalid CSV: header column 2 has no name',
      );
    });

    it('rejects mixed line endings (the line ending is taken from the first line)', () => {
      expect(() => parseCsvString('a,b\n"1","2"\r\n')).toThrow(ParserError);
    });

    it('keeps the original library error as the cause', () => {
      try {
        parseCsvString('a,b\n"1,2\n');
        throw new Error('expected parseCsvString to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ParserError);
        expect((error as ParserError).cause).toBeInstanceOf(Error);
      }
    });
  });
});

describe('parseCsvFile', () => {
  it('parses the real cake orders file', async () => {
    const records = await parseCsvFile(cakeOrdersPath);

    expect(records).toHaveLength(263);
    expect(records[0]).toEqual({
      id: '0',
      Type: 'Sponge',
      Flavor: 'Vanilla',
      Filling: 'Cream',
      Size: '20',
      Layers: '2',
      'Frosting Type': 'Buttercream',
      'Frosting Flavor': 'Vanilla',
      'Decoration Type': 'Sprinkles',
      'Decoration Color': 'Multi-color',
      'Custom Message': 'Happy Birthday',
      Shape: 'Round',
      Allergies: 'Nut-Free',
      'Special Ingredients': 'Organic Ingredients',
      'Packaging Type': 'Standard Box',
      Price: '50',
      Quantity: '1',
    });
  });

  it('gives every record in the real file the same 17 columns, with string values', async () => {
    const records = await parseCsvFile(cakeOrdersPath);

    for (const record of records) {
      expect(Object.keys(record)).toHaveLength(17);
      expect(Object.values(record).every((value) => typeof value === 'string')).toBe(true);
    }
  });

  it('keeps the empty Custom Message fields in the real file', async () => {
    const records = await parseCsvFile(cakeOrdersPath);

    expect(records.find((record) => record.id === '2')?.['Custom Message']).toBe('');
  });

  it('throws for an empty file and names the file', async () => {
    const filePath = path.join(fixturesDir, 'empty.csv');

    await expect(parseCsvFile(filePath)).rejects.toThrow(`CSV parser: input is empty (file: ${filePath})`);
  });

  it('throws for a malformed file and names the file', async () => {
    const filePath = path.join(fixturesDir, 'malformed.csv');

    await expect(parseCsvFile(filePath)).rejects.toMatchObject({ format: 'csv', filePath });
  });

  it('throws for a missing file', async () => {
    const filePath = path.join(fixturesDir, 'missing.csv');

    await expect(parseCsvFile(filePath)).rejects.toThrow(`CSV parser: file not found (file: ${filePath})`);
  });
});
