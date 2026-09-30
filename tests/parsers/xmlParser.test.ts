import { XMLParser } from 'fast-xml-parser';
import path from 'path';
import { ParserError } from '../../src/parsers/ParserError';
import { XmlElement, parseXmlFile, parseXmlString } from '../../src/parsers/xmlParser';

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const toyOrdersPath = path.join(__dirname, '..', '..', 'src', 'data', 'toy orders.xml');

describe('parseXmlString', () => {
  describe('valid input', () => {
    it('turns elements into an object keyed by the root element', () => {
      const xml = '<data><row><OrderID>5001</OrderID><Brand>FunTime</Brand></row></data>';

      expect(parseXmlString(xml)).toEqual({
        data: { row: [{ OrderID: '5001', Brand: 'FunTime' }] },
      });
    });

    it('keeps element text as the exact string in the file', () => {
      const xml = '<data><row><Price>007</Price><Educational>Yes</Educational><Flag>true</Flag></row></data>';

      expect(parseXmlString(xml)).toEqual({
        data: { row: [{ Price: '007', Educational: 'Yes', Flag: 'true' }] },
      });
    });

    it('ignores the XML declaration', () => {
      expect(parseXmlString("<?xml version='1.0' encoding='utf-8'?>\n<data><row><a>1</a></row></data>")).toEqual({
        data: { row: [{ a: '1' }] },
      });
    });

    it('decodes standard entities and CDATA sections', () => {
      expect(parseXmlString('<note><a>Tom &amp; Jerry &lt;3</a><b><![CDATA[1 < 2]]></b></note>')).toEqual({
        note: { a: 'Tom & Jerry <3', b: '1 < 2' },
      });
    });

    it('trims whitespace around element text', () => {
      expect(parseXmlString('<a>\n   padded   \n</a>')).toEqual({ a: 'padded' });
    });

    it('leaves unknown entities as they are (they are not validated)', () => {
      expect(parseXmlString('<a>&foo;</a>')).toEqual({ a: '&foo;' });
    });
  });

  describe('attributes', () => {
    it('keeps attributes with an "@_" prefix, as strings', () => {
      expect(parseXmlString('<store id="S1" open="true" rating="4.5"/>')).toEqual({
        store: { '@_id': 'S1', '@_open': 'true', '@_rating': '4.5' },
      });
    });

    it('puts text under "#text" when an element also has attributes', () => {
      expect(parseXmlString('<price currency="USD">247</price>')).toEqual({
        price: { '#text': '247', '@_currency': 'USD' },
      });
    });
  });

  describe('nested data', () => {
    it('preserves deeply nested elements and attributes', () => {
      const xml = `
        <store id="S1">
          <address><city>Amman</city><geo lat="31.95" lng="35.91"/></address>
          <orders>
            <row><OrderID>1</OrderID><items><item sku="A">Ball</item><item sku="B">Kite</item></items></row>
          </orders>
        </store>`;

      expect(parseXmlString(xml)).toEqual({
        store: {
          '@_id': 'S1',
          address: { city: 'Amman', geo: { '@_lat': '31.95', '@_lng': '35.91' } },
          orders: {
            row: [
              {
                OrderID: '1',
                items: {
                  item: [
                    { '#text': 'Ball', '@_sku': 'A' },
                    { '#text': 'Kite', '@_sku': 'B' },
                  ],
                },
              },
            ],
          },
        },
      });
    });
  });

  describe('single-child elements', () => {
    it('always returns <row> as an array, even when there is only one', () => {
      const result = parseXmlString('<data><row><OrderID>1</OrderID></row></data>');

      expect(result).toEqual({ data: { row: [{ OrderID: '1' }] } });
    });

    it('returns the same shape for one row as for many rows', () => {
      const one = parseXmlString('<data><row><a>1</a></row></data>');
      const two = parseXmlString('<data><row><a>1</a></row><row><a>2</a></row></data>');

      expect(Array.isArray((one.data as XmlElement).row)).toBe(true);
      expect(Array.isArray((two.data as XmlElement).row)).toBe(true);
    });

    it('does not wrap a root element named <row> in an array', () => {
      expect(parseXmlString('<row><a>1</a></row>')).toEqual({ row: { a: '1' } });
    });

    it('turns other repeated elements into arrays automatically', () => {
      expect(parseXmlString('<tags><tag>x</tag><tag>y</tag></tags>')).toEqual({ tags: { tag: ['x', 'y'] } });
    });
  });

  describe('missing or optional fields', () => {
    it('omits an element that is missing from one row', () => {
      const result = parseXmlString(
        '<data><row><OrderID>1</OrderID><Brand>FunTime</Brand></row><row><OrderID>2</OrderID></row></data>',
      );

      expect(result).toEqual({
        data: { row: [{ OrderID: '1', Brand: 'FunTime' }, { OrderID: '2' }] },
      });
    });

    it('returns an empty string for an empty element', () => {
      expect(parseXmlString('<row><Brand/><Material></Material></row>')).toEqual({
        row: { Brand: '', Material: '' },
      });
    });

    it('returns an empty string for a root element with no rows', () => {
      expect(parseXmlString('<data></data>')).toEqual({ data: '' });
    });
  });

  describe('empty input', () => {
    it.each([
      ['an empty string', ''],
      ['only whitespace', '  \n\t '],
    ])('throws for %s', (_label, xml) => {
      expect(() => parseXmlString(xml)).toThrow(new ParserError('xml', 'input is empty'));
    });
  });

  describe('malformed input', () => {
    it('reports the line and column of a mismatched closing tag', () => {
      const xml = '<data>\n  <row>\n    <OrderID>1</Order>\n  </row>\n</data>';

      expect(() => parseXmlString(xml)).toThrow(
        /^XML parser: invalid XML at line 3, column \d+: Expected closing tag 'OrderID'/,
      );
    });

    it.each([
      ['an unclosed tag', '<data><row>'],
      ['plain text', 'hello'],
      ['an attribute without quotes', '<a x=1/>'],
      ['an attribute without a value', '<a x>1</a>'],
      ['a duplicate attribute', '<a x="1" x="2"/>'],
      ['an invalid tag name', '<1a>x</1a>'],
      ['text before the root element', 'leading<a/>'],
      ['text after the root element', '<a>1</a> trailing'],
    ])('throws a ParserError for %s instead of returning partial data', (_label, xml) => {
      expect(() => parseXmlString(xml)).toThrow(ParserError);
      expect(() => parseXmlString(xml)).toThrow(/^XML parser: invalid XML/);
    });

    it('does not detect text after a self-closing root element (fast-xml-parser validator gap)', () => {
      // Documents a known library limitation: the trailing text is silently dropped.
      expect(parseXmlString('<a/>trailing')).toEqual({ a: '' });
    });

    it.each([
      ['two different root elements', '<a/><b/>'],
      ['two root elements with the same name', '<a/><a/>'],
    ])('throws for %s', (_label, xml) => {
      expect(() => parseXmlString(xml)).toThrow('XML parser: document must have exactly one root element');
    });

    it('wraps an unexpected parser failure on validated input in a ParserError', () => {
      const failure = new Error('internal parser failure');
      const parseSpy = jest.spyOn(XMLParser.prototype, 'parse').mockImplementation(() => {
        throw failure;
      });

      try {
        expect(() => parseXmlString('<a/>')).toThrow('XML parser: invalid XML: internal parser failure');
        expect(() => parseXmlString('<a/>')).toThrow(expect.objectContaining({ cause: failure }));
      } finally {
        parseSpy.mockRestore();
      }
    });

    it('keeps the validator details as the cause', () => {
      try {
        parseXmlString('<a><b></a>');
        throw new Error('expected parseXmlString to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ParserError);
        expect((error as ParserError).cause).toMatchObject({ code: 'InvalidTag', line: 1 });
      }
    });
  });
});

describe('parseXmlFile', () => {
  it('parses the real toy orders file', async () => {
    const result = await parseXmlFile(toyOrdersPath);
    const rows = (result.data as XmlElement).row;

    expect(Object.keys(result)).toEqual(['data']);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(250);
    expect((rows as XmlElement[])[0]).toEqual({
      OrderID: '5001',
      Type: 'Plush Toy',
      AgeGroup: '13+',
      Brand: 'FunTime',
      Material: 'Fabric',
      BatteryRequired: 'Yes',
      Educational: 'Yes',
      Price: '247',
      Quantity: '7',
    });
  });

  it('gives every row in the real file the same 9 fields', async () => {
    const result = await parseXmlFile(toyOrdersPath);
    const rows = (result.data as XmlElement).row as XmlElement[];

    for (const row of rows) {
      expect(Object.keys(row)).toHaveLength(9);
    }
  });

  it('throws for an empty file and names the file', async () => {
    const filePath = path.join(fixturesDir, 'empty.xml');

    await expect(parseXmlFile(filePath)).rejects.toThrow(`XML parser: input is empty (file: ${filePath})`);
  });

  it('throws for a malformed file and names the file', async () => {
    const filePath = path.join(fixturesDir, 'malformed.xml');

    await expect(parseXmlFile(filePath)).rejects.toMatchObject({ format: 'xml', filePath });
    await expect(parseXmlFile(filePath)).rejects.toThrow(/^XML parser: invalid XML at line 4/);
  });

  it('throws for a missing file', async () => {
    const filePath = path.join(fixturesDir, 'missing.xml');

    await expect(parseXmlFile(filePath)).rejects.toThrow(`XML parser: file not found (file: ${filePath})`);
  });
});
