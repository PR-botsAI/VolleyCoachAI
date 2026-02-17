import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  API_URL: z.string().default("http://localhost:3001"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Firebase Auth
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_CLUB: z.string().optional(),

  // Google Cloud Storage
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GCS_BUCKET_NAME: z.string().default("volleycoach-videos"),
  GCS_CREDENTIALS_JSON: z.string().optional(),

  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),

  // Mux Streaming
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),

  // Resend Email
  RESEND_API_KEY: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.format();
    console.error("Environment validation errors:");
    for (const [key, value] of Object.entries(formatted)) {
      if (key === "_errors") continue;
      const errors = (value as { _errors?: string[] })._errors;
      if (errors?.length) {
        console.error(`  ${key}: ${errors.join(", ")}`);
      }
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment configuration");
    }

    console.warn("Running with partial env in development mode");
    return envSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://volleycoach:volleycoach_dev@localhost:5432/volleycoach",
    });
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
