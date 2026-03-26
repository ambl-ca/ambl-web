import { defineMiddleware } from 'astro:middleware';
import logger from './lib/logger';

type RequestLog = Pick<typeof logger, 'warn' | 'error'>;

export const onRequest = defineMiddleware(async (context, next) => {
  const requestId = createRequestId();
  const log = createRequestLogger(context.request, context.url.pathname, requestId);

  try {
    const response = await next();

    response.headers.set('x-request-id', requestId);
    logResponseStatus(log, response.status);

    return response;
  } catch (error) {
    log.error({ event: 'request.unhandled_exception', err: error }, 'Unhandled request exception');
    throw error;
  }
});

function createRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
  );
}

function createRequestLogger(request: Request, path: string, requestId: string) {
  return logger.child({
    requestId,
    method: request.method,
    path,
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  });
}

function logResponseStatus(log: RequestLog, status: number): void {
  if (status >= 500) {
    log.error({ event: 'request.server_error', status }, 'Request completed with server error');
    return;
  }

  if (status >= 400) {
    log.warn({ event: 'request.client_error', status }, 'Request completed with client error');
  }
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return 'unknown';
  }

  return forwardedFor.split(',')[0]?.trim() || 'unknown';
}
