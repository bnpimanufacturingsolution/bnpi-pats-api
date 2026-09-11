import winston, { log } from "winston";
import { Logtail } from "@logtail/node";
import { LogtailTransport } from "@logtail/winston";
import type TransportStream from "winston-transport";
import { config } from "../config/config";
import {
	consoleKeyOf,
	durationBucket,
	getSharedCollapseConsoleWriter,
} from "./console-collapse";

const { combine, timestamp, json, errors, printf, colorize } = winston.format;

/**
 * Fixed 24h single-token console timestamp. A stable format keeps collapsed
 * console rows comparable (the collapse key strips exactly this prefix).
 */
function hhmmss(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Builds the full console line (info.consoleLine) plus its collapse identity
 * (info.consoleKey) for the CollapsingConsoleTransport. Request metadata is
 * rendered inline (method, path, status, bucketed duration) so access lines
 * are informative and collapse per endpoint/status instead of being a wall
 * of identical "Request completed" rows.
 */
export const consoleLineFormat = winston.format((info: winston.Logform.TransformableInfo) => {
	const { level, message, error, module, timestamp, ...meta } = info;

	let errorInfo = "";
	let stackInfo = "";
	if (error) {
		if (error instanceof Error) {
			errorInfo = ` | Error: ${error.message}`;
			if (error.stack) {
				stackInfo = `\nStack: ${error.stack}`;
			}
		} else if (typeof error === "string") {
			errorInfo = ` | Error: ${error}`;
		} else if (typeof error === "object" && "message" in error) {
			const errorRecord = error as Record<string, unknown>;
			errorInfo = ` | Error: ${errorRecord.message}`;
			if (errorRecord.stack) {
				stackInfo = `\nStack: ${errorRecord.stack}`;
			}
		}
	}

	let validationInfo = "";
	if (meta.errors && Array.isArray(meta.errors)) {
		const errorFields = meta.errors
			.map((err: unknown) => {
				const errRecord = err as Record<string, unknown>;
				return `${errRecord.field}: ${errRecord.message}`;
			})
			.join(", ");
		validationInfo = ` | Validation Errors: [${errorFields}]`;
	}

	const time = hhmmss(timestamp ? new Date(timestamp as string) : new Date());

	const moduleInfo = module ? `[${module}] ` : "";

	let mainMessage = message || "";
	if (typeof mainMessage === "string" && mainMessage.includes("request body:")) {
		mainMessage = mainMessage.replace(
			/request body:\s*\{[\s\S]*\}/,
			"request body: [FILTERED]",
		);
	}

	let requestInfo = "";
	if (meta.method && meta.path) {
		const status = typeof meta.statusCode === "number" ? ` ${meta.statusCode}` : "";
		const bucketed = durationBucket(meta.duration);
		requestInfo = ` ${meta.method} ${meta.path}${status}${bucketed ? ` ${bucketed}` : ""}`;
	}

	const line = `${time} ${String(level).toUpperCase()} ${moduleInfo}${mainMessage}${requestInfo}${errorInfo}${validationInfo}${stackInfo}`;
	info.consoleLine = line;
	info.consoleKey = consoleKeyOf(line);
	return info;
})();

/**
 * Console transport that collapses consecutive identical lines into one row
 * with a repetition counter (see helper/console-collapse.ts). File transports
 * are unaffected and keep every record with exact metadata.
 *
 * winston re-exports the winston-transport base class at runtime as
 * `winston.Transport`; its bundled typings only alias the lowercase
 * `winston.transport`, which does not exist at runtime, so the base is
 * resolved through a cast typed by winston-transport's own declarations.
 */
const TransportBase = (winston as unknown as { Transport: typeof TransportStream }).Transport;

class CollapsingConsoleTransport extends TransportBase {
	public name = "collapsing-console";

	public log(info: Record<string, unknown>, callback: () => void): void {
		setImmediate(() => this.emit("logged", info));
		const line =
			typeof info.consoleLine === "string" ? info.consoleLine : String(info.message ?? "");
		getSharedCollapseConsoleWriter().write(line);
		callback();
	}
}

export const getLogger = () => {
	const logTransports: (winston.transport | LogtailTransport)[] = [
		new CollapsingConsoleTransport({
			format: combine(colorize(), timestamp(), consoleLineFormat),
		}),
		new winston.transports.File({
			filename: "logs/info.log",
			level: "info",
			format: combine(timestamp(), errors({ stack: true }), json()),
		}),
		new winston.transports.File({
			filename: "logs/error.log",
			level: "error",
			format: combine(timestamp(), errors({ stack: true }), json()),
		}),
	];

	if (config.betterStackSourceToken) {
		const logtail = new Logtail(config.betterStackSourceToken, {
			endpoint: config.betterStackHost,
		});
		logTransports.push(new LogtailTransport(logtail));
	}

	const logger = winston.createLogger({
		level: process.env.NODE_ENV === "production" ? "info" : "debug",
		format: combine(timestamp(), errors({ stack: true }), json()),
		transports: logTransports,
		exceptionHandlers: [
			new winston.transports.File({ filename: "logs/exception.log" }),
			new winston.transports.Console({
				format: combine(
					colorize(),
					timestamp(),
					printf((info: Record<string, unknown>) => {
						const { level, message, stack, timestamp } = info;
						const time = hhmmss(timestamp ? new Date(timestamp as string) : new Date());
						return `${time} ${String(level).toUpperCase()} EXCEPTION: ${message}\n${stack || ""}`;
					}),
				),
			}),
		],
		rejectionHandlers: [
			new winston.transports.File({ filename: "logs/rejection.log" }),
			new winston.transports.Console({
				format: combine(
					colorize(),
					timestamp(),
					printf((info: Record<string, unknown>) => {
						const { level, message, stack, timestamp } = info;
						const time = hhmmss(timestamp ? new Date(timestamp as string) : new Date());
						return `${time} ${String(level).toUpperCase()} REJECTION: ${message}\n${stack || ""}`;
					}),
				),
			}),
		],
	});

	return logger;
};

/**
 * Create a child logger for a specific module
 * Simplifies the common pattern of getLogger().child({ module: "name" })
 *
 * @param moduleName - The name of the module (e.g., "category", "project-controller")
 * @returns A winston Logger instance with the module context
 *
 * @example
 * // Before (repeated in every controller):
 * const logger = getLogger();
 * const categoryLogger = logger.child({ module: "category" });
 *
 * // After (single line):
 * const logger = createLogger("category");
 */
export const createLogger = (moduleName: string) => {
	return getLogger().child({ module: moduleName });
};
