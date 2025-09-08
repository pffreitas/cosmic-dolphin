import Fastify from 'fastify';
import { config } from './config/environment';

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

server.register(require('@fastify/env'), {
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