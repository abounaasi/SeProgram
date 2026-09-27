import { ParserError, describeError } from '../../src/parsers/ParserError';

describe('ParserError', () => {
  it('is an Error that can be caught as a ParserError', () => {
    const error = new ParserError('json', 'input is empty');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ParserError);
    expect(error.name).toBe('ParserError');
  });

  it('prefixes the message with the parser format', () => {
    const error = new ParserError('xml', 'input is empty');

    expect(error.message).toBe('XML parser: input is empty');
    expect(error.format).toBe('xml');
    expect(error.filePath).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  it('includes the file path and keeps the original error as the cause', () => {
    const original = new SyntaxError('Unexpected token');
    const error = new ParserError('csv', 'invalid CSV', { filePath: 'orders.csv', cause: original });

    expect(error.message).toBe('CSV parser: invalid CSV (file: orders.csv)');
    expect(error.filePath).toBe('orders.csv');
    expect(error.cause).toBe(original);
  });
});

describe('describeError', () => {
  it('returns the message of an Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });

  it('reads the message of an error-like object that is not an Error instance', () => {
    // e.g. an Error created in another JavaScript realm, such as Node's fs errors under Jest
    expect(describeError({ message: 'from another realm' })).toBe('from another realm');
  });

  it('converts anything else that was thrown to a string', () => {
    expect(describeError(null)).toBe('null');
    expect(describeError({ message: 404 })).toBe('[object Object]');
    expect(describeError('plain string')).toBe('plain string');
    expect(describeError(42)).toBe('42');
  });
});
