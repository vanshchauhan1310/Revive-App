import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { createAuth } from './middleware/auth.js';
import { limiters as defaultLimiters } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './errors.js';
import { createModeration } from './services/moderation.js';
import { createPredictionLog } from './services/predictions.js';
import { createImpact } from './services/impact.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { listingRoutes } from './routes/listings.js';
import { feedRoutes } from './routes/feed.js';
import { orderRoutes } from './routes/orders.js';
import { chatRoutes } from './routes/chats.js';
import { creditRoutes } from './routes/credits.js';
import { notificationRoutes } from './routes/notifications.js';
import { safetyRoutes } from './routes/safety.js';
import { eventRoutes } from './routes/events.js';
import { aiRoutes } from './routes/ai.js';
import { impactRoutes } from './routes/impact.js';
import { adminRoutes } from './routes/admin.js';

// Builds the Express app from injected dependencies so tests can supply fakes.
export function createApp({ config, admin, anonDb, userClient, ml, logger, limiters = defaultLimiters }) {
  const logPrediction = createPredictionLog({ admin, logger });
  const moderation = createModeration({ ml, logPrediction });
  const impact = createImpact({ admin, ml, logPrediction, logger });
  const auth = createAuth({ admin, userClient });
  const deps = { config, admin, anonDb, ml, logger, limiters, auth, logPrediction, moderation, impact };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
    credentials: false,
  }));
  app.use(express.json({ limit: '200kb' }));
  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.get('x-request-id') ?? randomUUID(),
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url }) },
  }));

  app.use(healthRoutes(deps));
  app.use('/api', limiters.global);
  for (const routes of [meRoutes, listingRoutes, feedRoutes, orderRoutes, chatRoutes, creditRoutes,
    notificationRoutes, safetyRoutes, eventRoutes, aiRoutes, impactRoutes, adminRoutes]) {
    app.use('/api', routes(deps));
  }
  app.use((_req, _res, next) => next(notFound('route_not_found', 'Unknown endpoint.')));
  app.use(errorHandler(logger));
  return { app, deps };
}
