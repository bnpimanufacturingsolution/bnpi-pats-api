import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
	// Server
	PORT: z.coerce.number().default(3000),
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

	// Logging
	BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
	BETTER_STACK_HOST: z.string().optional(),

	// CORS
	CORS_ORIGINS: z.string().default("http://localhost:5173"),
	CORS_CREDENTIALS: z.enum(["true", "false"]).default("false"),

	// Redis
	REDIS_URL: z.string().default("redis://localhost:6379"),
	REDIS_HOST: z.string().default("localhost"),
	REDIS_PORT: z.coerce.number().default(6379),
	REDIS_PASSWORD: z.string().optional(),
	REDIS_DB: z.coerce.number().default(0),
	REDIS_ENABLED: z.enum(["true", "false"]).default("true"),

	// Authentication
	JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
	ENABLE_TEST_MODE: z.enum(["true", "false"]).default("false"),
	ENABLE_LEGACY_API: z.enum(["true", "false"]).default("false"),

	// SSO
	SSO_BASE_URL: z.string().default("http://localhost:3000/api"),

	// Cloudinary
	CLOUDINARY_CLOUD_NAME: z.string().optional(),
	CLOUDINARY_API_KEY: z.string().optional(),
	CLOUDINARY_API_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("❌ Invalid environment variables:");
	console.error(parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === "production" && env.ENABLE_TEST_MODE === "true") {
	console.error("❌ ENABLE_TEST_MODE=true is not allowed when NODE_ENV=production (it bypasses authentication).");
	process.exit(1);
}
