"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const environment_1 = require("./config/environment");
const server = (0, fastify_1.default)({
    logger: environment_1.config.NODE_ENV === 'development' ? {
        level: environment_1.config.LOG_LEVEL,
        transport: {
            target: 'pino-pretty'
        }
    } : {
        level: environment_1.config.LOG_LEVEL
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
            port: environment_1.config.PORT,
            host: environment_1.config.HOST
        });
        server.log.info(`Server listening on ${environment_1.config.HOST}:${environment_1.config.PORT}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map