import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';
import { ParserError } from '../../src/parsers/ParserError';
import { readFileContent } from '../../src/parsers/readFileContent';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

describe('readFileContent', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'parser-tests-'));
  });

  afterAll(async () => {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the text content of a file', async () => {
    const filePath = path.join(tempDir, 'plain.txt');
    await fsPromises.writeFile(filePath, 'hello', 'utf8');

    await expect(readFileContent(filePath, 'csv')).resolves.toBe('hello');
  });

  it('strips a leading byte order mark', async () => {
    const filePath = path.join(tempDir, 'bom.json');
    await fsPromises.writeFile(filePath, Buffer.from([0xef, 0xbb, 0xbf, ...Buffer.from('{}')]));

    await expect(readFileContent(filePath, 'json')).resolves.toBe('{}');
  });

  it('returns an empty string for an empty file (the parsers decide that is an error)', async () => {
    await expect(readFileContent(path.join(fixturesDir, 'empty.json'), 'json')).resolves.toBe('');
  });

  it('throws a ParserError when the file does not exist', async () => {
    const filePath = path.join(fixturesDir, 'does-not-exist.json');

    await expect(readFileContent(filePath, 'json')).rejects.toThrow(ParserError);
    await expect(readFileContent(filePath, 'json')).rejects.toMatchObject({
      format: 'json',
      filePath,
      message: `JSON parser: file not found (file: ${filePath})`,
    });
  });

  it('throws a ParserError when the path is a directory', async () => {
    await expect(readFileContent(fixturesDir, 'xml')).rejects.toThrow(
      'XML parser: path is a directory, not a file',
    );
  });

  it('reports permission problems', async () => {
    const accessError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    jest.spyOn(fsPromises, 'readFile').mockRejectedValue(accessError);

    await expect(readFileContent('locked.csv', 'csv')).rejects.toMatchObject({
      message: 'CSV parser: permission denied (file: locked.csv)',
      cause: accessError,
    });
  });

  it('reports any other read failure with its original message', async () => {
    jest.spyOn(fsPromises, 'readFile').mockRejectedValue(new Error('disk on fire'));

    await expect(readFileContent('any.csv', 'csv')).rejects.toThrow(
      'CSV parser: could not read file: disk on fire',
    );
  });

  it('handles a read failure that is not an Error object', async () => {
    jest.spyOn(fsPromises, 'readFile').mockRejectedValue('weird failure');

    await expect(readFileContent('any.csv', 'csv')).rejects.toThrow(
      'CSV parser: could not read file: weird failure',
    );
  });
});
