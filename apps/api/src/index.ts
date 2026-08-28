import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import env from '@fastify/env';
import { config } from './config/environment';
import { registerRateLimiting } from './plugins/rate-limit';
import bookmarkRoutes from './routes/bookmarks';
import collectionRoutes from './routes/collections';
import readingRoutes from './routes/reading';
import searchRoutes from './routes/search';
import profileRoutes from './routes/profile';
import userRoutes from './routes/users';
import commentRoutes from './routes/comments';
import feedRoutes from './routes/feed';
import digestRoutes from './routes/digests';

const server = Fastify({
  logger: config.NODE_ENV === 'development' ? {
    level: config.LOG_LEVEL,
    transport: {
      target: 'pino-pretty'
    }
  } : {
    level: config.LOG_LEVEL
  }
});

// Register plugins
server.register(cors, {
  // Restrict CORS to explicit trusted frontend origins.
  origin: config.FRONTEND_ORIGINS,
});

server.register(helmet);

// Before the routes: the limiter attaches itself through an onRoute hook.
registerRateLimiting(server);

server.register(env, {
  dotenv: true,
  schema: {
    type: 'object',
    required: ['PORT'],
    properties: {
      PORT: { type: 'string', default: '3000' },
      NODE_ENV: { type: 'string', default: 'development' }
    }
  }
});

// Health check route
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// API routes
server.register(async function (fastify) {
  fastify.get('/api/v1/status', async () => {
    return { message: 'Cosmic Dolphin API is running', version: '1.0.0' };
  });
  
  // Register routes with /api/v1 prefix
  await fastify.register(bookmarkRoutes, { prefix: '/api/v1' });
  await fastify.register(collectionRoutes, { prefix: '/api/v1' });
  await fastify.register(readingRoutes, { prefix: '/api/v1' });
  await fastify.register(searchRoutes, { prefix: '/api/v1' });
  await fastify.register(profileRoutes, { prefix: '/api/v1' });
  await fastify.register(userRoutes, { prefix: '/api/v1' });
  await fastify.register(commentRoutes, { prefix: '/api/v1' });
  // The ranked feed. Registered after the bookmark routes, which no longer
  // carry `/bookmarks/feed` — the route moved, it was not duplicated.
  await fastify.register(feedRoutes, { prefix: '/api/v1' });
  // Digests are their own resource, not a corner of the feed: they have a
  // detail route, likes and a share link of their own.
  await fastify.register(digestRoutes, { prefix: '/api/v1' });
});

// Start server
const start = async () => {
  try {
    await server.listen({
      port: config.PORT, 
      host: config.HOST 
    });
    server.log.info(`Server listening on ${config.HOST}:${config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
