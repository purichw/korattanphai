import { createHash, timingSafeEqual } from 'node:crypto';

const ID = /^[a-z][a-z0-9_-]{0,63}$/;

export function isValidToken(token) {
  return typeof token === 'string' && /^[A-Za-z0-9._~+\/-]{32,512}={0,2}$/.test(token);
}

export function clientsFromEnvironment(value) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 32768) throw new Error('Invalid MODEL_INPUT_CLIENTS_JSON.');
  try { return JSON.parse(value); } catch { throw new Error('Invalid MODEL_INPUT_CLIENTS_JSON.'); }
}

export function createIntegrationAuth({ token, readToken, sourceId, clients } = {}) {
  if (typeof sourceId !== 'string' || !ID.test(sourceId)) throw new Error('MODEL_INPUT_SOURCE_ID is required and must be a lowercase identifier.');
  if (clients === undefined && !isValidToken(token) || token !== undefined && !isValidToken(token)) {
    throw new Error('MODEL_INPUT_API_TOKEN must be a strong token of at least 32 characters.');
  }
  if (readToken !== undefined && (!isValidToken(readToken) || readToken === token)) {
    throw new Error('MODEL_INPUT_READ_TOKEN must be a different strong token of at least 32 characters.');
  }
  if (clients !== undefined && (!Array.isArray(clients) || clients.length < 1 || clients.length > 32)) {
    throw new Error('MODEL_INPUT_CLIENTS_JSON must contain 1–32 integration identities.');
  }
  const configured = [
    ...(token === undefined ? [] : [{ id: 'legacy-writer', role: 'writer', sourceId, tokens: [token] }]),
    ...(readToken === undefined ? [] : [{ id: 'legacy-reader', role: 'reader', sourceId, tokens: [readToken] }]),
    ...(clients ?? []),
  ];
  const ids = new Set();
  const tokenHashes = new Set();
  const digests = [];
  for (const client of configured) {
    if (!client || typeof client !== 'object' || Array.isArray(client)
      || Object.keys(client).sort().join() !== 'id,role,sourceId,tokens'
      || typeof client.id !== 'string' || !ID.test(client.id) || ids.has(client.id)
      || !['reader', 'writer'].includes(client.role) || client.sourceId !== sourceId
      || !Array.isArray(client.tokens) || client.tokens.length < 1 || client.tokens.length > 2) {
      throw new Error('Invalid or duplicate model-input integration identity or source scope.');
    }
    ids.add(client.id);
    for (const value of client.tokens) {
      if (!isValidToken(value)) throw new Error('Integration tokens must be strong tokens of at least 32 characters.');
      const digest = createHash('sha256').update(value).digest();
      const hex = digest.toString('hex');
      if (tokenHashes.has(hex)) throw new Error('Integration tokens must be unique across identities and rotation slots.');
      tokenHashes.add(hex);
      digests.push({ digest, client: { id: client.id, role: client.role, sourceId: client.sourceId } });
    }
  }
  return {
    authenticate(authorization) {
      if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
      const candidate = authorization.slice(7);
      if (!isValidToken(candidate)) return null;
      const digest = createHash('sha256').update(candidate).digest();
      let matched = null;
      // Compare every slot, including rotation slots, without an early return.
      for (const record of digests) if (timingSafeEqual(digest, record.digest)) matched = record.client;
      return matched;
    },
  };
}
