import pino from 'pino';

export function createLogger(level = 'info', pretty = false) {
  return pino({
    level,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'headers.authorization', '*.access_token', '*.code'],
      censor: '[redacted]',
    },
    ...(pretty ? { transport: { target: 'pino-pretty' } } : {}),
  });
}
