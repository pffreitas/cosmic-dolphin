import Fastify from 'fastify';
import { config } from './config/environment';
import bookmarkRoutes from './routes/bookmarks';

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
server.register(require('@fastify/cors'), {
  origin: true
});

server.register(require('@fastify/helmet'));

// Health check route
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// API routes
server.register(async function (fastify) {
  fastify.get('/api/v1/status', async () => {
    return { message: 'Cosmic Dolphin API is running', version: '1.0.0' };
  });
  
  // Register bookmark routes with /api/v1 prefix
  await fastify.register(bookmarkRoutes, { prefix: '/api/v1' });
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