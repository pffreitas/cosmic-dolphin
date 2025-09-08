"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3030', 10),
    HOST: process.env.HOST || '0.0.0.0',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    // Database
    DATABASE_URL: process.env.DATABASE_URL || '',
    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
};
//# sourceMappingURL=environment.js.map