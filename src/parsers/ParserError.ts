export type ParserFormat = 'csv' | 'json' | 'xml';

interface ParserErrorOptions {
  filePath?: string;
  cause?: unknown;
}

/**
 * The single error type thrown by every parser, so callers only need one catch.
 * The original low-level error (e.g. a SyntaxError from JSON.parse) is kept in `cause`.
 */
export class ParserError extends Error {
  readonly format: ParserFormat;
  readonly filePath?: string;
  readonly cause?: unknown;

  constructor(format: ParserFormat, reason: string, options: ParserErrorOptions = {}) {
    const location = options.filePath ? ` (file: ${options.filePath})` : '';
    super(`${format.toUpperCase()} parser: ${reason}${location}`);
    this.name = 'ParserError';
    this.format = format;
    this.filePath = options.filePath;
    this.cause = options.cause;
  }
}

/**
 * Extracts a readable message from anything that was thrown.
 * Uses a shape check instead of `instanceof Error`, which fails for errors created in
 * another JavaScript realm (for example Node's fs errors when running under Jest).
 */
export function describeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}
