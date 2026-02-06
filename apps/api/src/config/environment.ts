import dotenv from "dotenv";

dotenv.config();

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.API_PORT || "3001", 10),
  HOST: process.env.HOST || "0.0.0.0",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Database
  DATABASE_URL: requiredEnv("DATABASE_URL"),

  // Supabase
  SUPABASE_URL: requiredEnv("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
};
