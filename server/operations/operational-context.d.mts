import type { IncomingMessage, ServerResponse } from 'node:http';
export function createOperationalContextHandler(options?: { now?: () => Date }): (request: IncomingMessage, response: ServerResponse) => void;
