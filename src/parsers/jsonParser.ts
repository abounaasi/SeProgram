import { ParserError, describeError } from './ParserError';
import { readFileContent } from './readFileContent';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * Parses JSON text. All JSON types (strings, numbers, booleans, null, arrays and
 * nested objects) are returned as-is; nothing is converted.
 * @param filePath only used to make error messages point at the source file
 */
export function parseJsonString(content: string, filePath?: string): JsonValue {
  if (content.trim() === '') {
    throw new ParserError('json', 'input is empty', { filePath });
  }

  try {
    // JSON.parse is typed as `any`, but it can only ever produce a JsonValue.
    return JSON.parse(content) as JsonValue;
  } catch (error) {
    throw new ParserError('json', `invalid JSON: ${describeError(error)}`, { filePath, cause: error });
  }
}

/** Reads a JSON file from disk and parses it. */
export async function parseJsonFile(filePath: string): Promise<JsonValue> {
  const content = await readFileContent(filePath, 'json');
  return parseJsonString(content, filePath);
}
