import { readFile } from 'fs/promises';
import { ParserError, ParserFormat, describeError } from './ParserError';

const BYTE_ORDER_MARK = 0xfeff;

function readFailureReason(error: unknown): string {
  // Shape check rather than `instanceof Error`: see describeError for why.
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  switch (code) {
    case 'ENOENT':
      return 'file not found';
    case 'EISDIR':
      return 'path is a directory, not a file';
    case 'EACCES':
      return 'permission denied';
    default:
      return `could not read file: ${describeError(error)}`;
  }
}

/**
 * Reads a UTF-8 text file for a parser. File-system failures become a ParserError,
 * and a leading byte order mark (added by some Windows editors) is stripped.
 */
export async function readFileContent(filePath: string, format: ParserFormat): Promise<string> {
  try {
    const content = await readFile(filePath, 'utf8');
    return content.charCodeAt(0) === BYTE_ORDER_MARK ? content.slice(1) : content;
  } catch (error) {
    throw new ParserError(format, readFailureReason(error), { filePath, cause: error });
  }
}
