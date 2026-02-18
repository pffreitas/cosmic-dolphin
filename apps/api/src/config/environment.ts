import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
});

let parsed;

try {
  parsed = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment configuration:");
    error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    });
  } else {
    console.error("❌ Failed to load environment configuration:", error);
  }
  process.exit(1);
}

export const config = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.API_PORT,
  HOST: parsed.HOST,
  LOG_LEVEL: parsed.LOG_LEVEL,
  DATABASE_URL: parsed.DATABASE_URL,
  SUPABASE_URL: parsed.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: parsed.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET: parsed.JWT_SECRET,
};
