import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ParserError, describeError } from './ParserError';
import { readFileContent } from './readFileContent';

/**
 * Parsed XML. Element text and attribute values are kept as the exact strings in the file.
 * Attributes are keys prefixed with "@_"; an element that has both attributes and text
 * keeps its text under "#text". An empty element (<Tag/>) becomes "".
 */
export type XmlValue = string | XmlElement | XmlValue[];
export type XmlElement = { [key: string]: XmlValue };

/**
 * Tags that must always be arrays, even when only one occurs. Without this, a store file
 * with a single <row> would give an object while a file with many gives an array.
 * In the store data, <row> is the only repeating element.
 */
const ALWAYS_ARRAY_TAGS = new Set(['row']);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreDeclaration: true,
  // A path without a dot is the root element, which must stay a single element.
  isArray: (tagName, jPath, _isLeafNode, isAttribute) =>
    !isAttribute && String(jPath).includes('.') && ALWAYS_ARRAY_TAGS.has(tagName),
});

/**
 * Parses XML text into an object keyed by the root element's name.
 * The input is validated first, so malformed XML throws instead of returning partial data.
 * @param filePath only used to make error messages point at the source file
 */
export function parseXmlString(content: string, filePath?: string): XmlElement {
  if (content.trim() === '') {
    throw new ParserError('xml', 'input is empty', { filePath });
  }

  const validation = XMLValidator.validate(content);
  if (validation !== true) {
    const { msg, line, col } = validation.err;
    throw new ParserError('xml', `invalid XML at line ${line}, column ${col}: ${msg}`, {
      filePath,
      cause: validation.err,
    });
  }

  let document: XmlElement;
  try {
    // XMLParser.parse is typed as `any`; with the options above it only produces XmlValue shapes.
    document = xmlParser.parse(content) as XmlElement;
  } catch (error) {
    throw new ParserError('xml', `invalid XML: ${describeError(error)}`, { filePath, cause: error });
  }

  // The validator accepts several top-level elements, but a well-formed document has exactly one.
  const rootNames = Object.keys(document);
  if (rootNames.length !== 1 || Array.isArray(document[rootNames[0]])) {
    throw new ParserError('xml', 'document must have exactly one root element', { filePath });
  }

  return document;
}

/** Reads an XML file from disk and parses it. */
export async function parseXmlFile(filePath: string): Promise<XmlElement> {
  const content = await readFileContent(filePath, 'xml');
  return parseXmlString(content, filePath);
}
