import { parse } from 'csv-parse/sync';
import { ParserError, describeError } from './ParserError';
import { readFileContent } from './readFileContent';

/** One CSV row, keyed by the header names. Values are kept as the exact strings in the file. */
export type CsvRecord = Record<string, string>;

/**
 * Rejects headers that csv-parse would otherwise accept silently:
 * a duplicate name overwrites the earlier column, and an empty name loses the column's meaning.
 */
function validateHeader(header: string[]): string[] {
  const seen = new Set<string>();
  header.forEach((name, index) => {
    if (name.trim() === '') {
      throw new Error(`header column ${index + 1} has no name`);
    }
    if (seen.has(name)) {
      throw new Error(`duplicate header column "${name}"`);
    }
    seen.add(name);
  });
  return header;
}

/**
 * Parses CSV text whose first row is the header into an array of records.
 * @param filePath only used to make error messages point at the source file
 */
export function parseCsvString(content: string, filePath?: string): CsvRecord[] {
  if (content.trim() === '') {
    throw new ParserError('csv', 'input is empty', { filePath });
  }

  try {
    return parse<CsvRecord>(content, {
      columns: validateHeader,
      skip_empty_lines: true,
    });
  } catch (error) {
    throw new ParserError('csv', `invalid CSV: ${describeError(error)}`, { filePath, cause: error });
  }
}

/** Reads a CSV file from disk and parses it. */
export async function parseCsvFile(filePath: string): Promise<CsvRecord[]> {
  const content = await readFileContent(filePath, 'csv');
  return parseCsvString(content, filePath);
}
