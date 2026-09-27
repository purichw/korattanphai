import type { IncomingMessage, ServerResponse } from 'node:http';
export function configuredCmsHandler(env?: Record<string, string | undefined>): (request: IncomingMessage, response: ServerResponse) => Promise<void>;
