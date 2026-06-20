import { env } from "./env";

export const config = {
	port: env.PORT,
	baseApiPath: "/api",
	betterStackSourceToken: env.BETTER_STACK_SOURCE_TOKEN ?? "",
	betterStackHost: env.BETTER_STACK_HOST ?? "",
	cors: {
		origins: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
		credentials: env.CORS_CREDENTIALS === "true",
	},
	redis: {
		url: env.REDIS_URL,
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		password: env.REDIS_PASSWORD,
		db: env.REDIS_DB,
		enabled: env.REDIS_ENABLED === "true",
	},
	cloudinary: {
		cloudName: env.CLOUDINARY_CLOUD_NAME ?? "",
		apiKey: env.CLOUDINARY_API_KEY ?? "",
		apiSecret: env.CLOUDINARY_API_SECRET ?? "",
	},
};
