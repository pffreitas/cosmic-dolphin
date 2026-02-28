import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL").min(1, "SUPABASE_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
});

const parsedEnv = envSchema.parse({
  ...process.env,
  PORT: process.env.PORT || process.env.API_PORT,
});

export const config = {
  NODE_ENV: parsedEnv.NODE_ENV,
  PORT: parsedEnv.PORT,
  HOST: parsedEnv.HOST,
  LOG_LEVEL: parsedEnv.LOG_LEVEL,
  DATABASE_URL: parsedEnv.DATABASE_URL,
  SUPABASE_URL: parsedEnv.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: parsedEnv.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET: parsedEnv.JWT_SECRET,
};
