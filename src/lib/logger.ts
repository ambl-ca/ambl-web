import pino from 'pino';

const baseConfig = {
};

const pretty = import.meta.env.DEV
  ? await import('pino-pretty').then((module) => module.default).catch(() => null)
  : null;

const logger = pretty
  ? pino(
    {
      level: import.meta.env.LOG_LEVEL ?? 'info',
      base: {
        service: 'ambl-web',
      },
    },
    pretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    })
  )
  : pino(baseConfig);

export default logger;
