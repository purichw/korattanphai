import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function operationError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

/** Operator-selected paths must not traverse symlinks. New paths are private. */
export async function safeDirectory(directory, { create = true } = {}) {
  if (typeof directory !== 'string' || !directory) throw operationError('invalid_directory');
  const absolute = path.resolve(directory);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (create) {
      try { await fs.mkdir(current, { mode: 0o700 }); }
      catch (error) { if (error.code !== 'EEXIST') throw operationError('directory_unavailable'); }
    }
    const stat = await fs.lstat(current).catch(() => { throw operationError('directory_unavailable'); });
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw operationError('unsafe_directory');
  }
  return absolute;
}

export async function readJson(filename, maxBytes = 2 * 1024 * 1024) {
  await safeDirectory(path.dirname(filename), { create: false });
  let handle;
  try {
    handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw operationError('invalid_file_size');
    const buffer = Buffer.alloc(Math.min(maxBytes + 1, 128 * 1024));
    const chunks = []; let size = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, maxBytes + 1 - size), null);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > maxBytes) throw operationError('invalid_file_size');
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error.code === 'ENOENT') throw error;
    if (['invalid_file_size', 'unsafe_directory'].includes(error.code)) throw error;
    throw operationError('invalid_json_file');
  } finally { await handle?.close(); }
}

/** Publish a complete, synced inode exclusively; interrupted temp files are never read. */
export async function writeJson(filename, value, maxBytes = 2 * 1024 * 1024) {
  await safeDirectory(path.dirname(filename), { create: false });
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  if (bytes.length > maxBytes) throw operationError('file_limit_exceeded');
  const temporary = path.join(path.dirname(filename), `.pending-${randomUUID()}.tmp`);
  let handle, createdTemporary = false;
  try {
    handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    createdTemporary = true;
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close(); handle = undefined;
    await fs.link(temporary, filename);
  } finally {
    await handle?.close();
    // Only this invocation's unique temporary inode is removed, never user data.
    if (createdTemporary) await fs.unlink(temporary).catch(() => {});
  }
  // Persist the newly created directory entry as well as its contents.
  const parent = await fs.open(path.dirname(filename), constants.O_RDONLY);
  try { await parent.sync(); } finally { await parent.close(); }
}

export async function jsonExists(filename) {
  try { return await readJson(filename); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export function parseOptions(args, allowed) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!allowed.includes(key) || !args[index + 1] || args[index + 1].startsWith('--') || Object.hasOwn(options, key)) throw operationError('invalid_arguments');
    options[key] = args[index + 1];
  }
  return options;
}

export function tokenFromEnv(name = 'MODEL_INPUT_API_TOKEN', env = process.env) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw operationError('invalid_token_env');
  const token = env[name];
  if (typeof token !== 'string' || !/^[A-Za-z0-9._~+\/-]{32,512}={0,2}$/.test(token)) throw operationError('invalid_api_token');
  return token;
}

export function checkedEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw operationError('invalid_endpoint'); }
  if (url.username || url.password || url.hash || url.search || !(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw operationError('invalid_endpoint');
  return url;
}

export function parseRetryAfter(value, nowMs = Date.now()) {
  if (typeof value !== 'string' || value.length > 128) return null;
  if (/^\d{1,10}$/.test(value)) return Number(value);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - nowMs) / 1000)) : null;
}
