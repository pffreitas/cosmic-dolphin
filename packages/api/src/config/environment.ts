import dotenv from "dotenv";

dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.API_PORT || "3001", 10),
  HOST: process.env.HOST || "0.0.0.0",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Database
  DATABASE_URL: process.env.DATABASE_URL || "",

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",

  // Redis
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
};
