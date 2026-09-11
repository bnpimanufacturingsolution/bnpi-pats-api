/**
 * Console output shaping for the local/dev console transport.
 *
 * Repetitive log lines (health polls, per-request access logs, cache
 * warnings) pile up and bury useful output. The collapse writer replaces
 * consecutive identical lines with a single row and a repetition counter,
 * e.g.:
 *
 *   10:46:34 INFO Request completed GET /api/v1/health 200 10ms (x47)
 *
 * On a TTY the counter row updates in place. When output is piped (CI, log
 * files) rows are never rewritten: the first occurrence prints plainly and a
 * `line (xN)` summary is emitted when a different line arrives, so ordering
 * is preserved. File transports keep every record with exact metadata.
 */

export const DIM = "\u001b[2m";
export const RESET = "\u001b[0m";
export const CLEAR_EOL = "\u001b[0K";

/** Console timestamps use a fixed 24h HH:mm:ss prefix (single token). */
const TIME_PREFIX = /^\d{1,2}:\d{2}:\d{2}\s/;

/**
 * Collapse identity of a console line: the line without its time prefix, so
 * a rolling clock does not reset an in-progress counter every second.
 */
export function consoleKeyOf(line: string): string {
	return line.replace(TIME_PREFIX, "");
}

/**
 * Renders a pending row with its repetition counter. TTY rows are rewritten
 * in place (carriage return + clear to end of line); piped output gets a
 * plain-text summary so ANSI codes never leak into logs.
 */
export function renderCount(line: string, count: number, isTTY: boolean): string {
	const suffix = isTTY ? `${DIM} (×${count})${RESET}${CLEAR_EOL}` : ` (×${count})`;
	return isTTY ? `\r${line}${suffix}` : `${line}${suffix}`;
}

/**
 * Buckets a `${ms}ms` duration string so identical endpoint+status requests
 * render an identical console line while timings jitter. Exact values stay
 * available in the JSON file transports. Unparsable input passes through.
 */
export function durationBucket(duration: unknown): string {
	if (typeof duration !== "string") return "";
	const match = duration.match(/^(\d+(?:\.\d+)?)ms$/);
	if (!match) return duration;
	const ms = Number(match[1]);
	if (ms < 1000) return `${Math.max(1, Math.round(ms / 10) * 10)}ms`;
	return `${Math.round(ms / 100) / 10}s`;
}

export interface CollapseWriterOptions {
	/** Low-level output sink (e.g. a bound process.stdout.write). */
	write: (chunk: string) => void;
	isTTY: boolean;
}

export interface CollapseConsoleWriter {
	/** Write one fully formatted console line (no trailing newline). */
	write: (line: string) => void;
	/** Finalize the in-progress row, if any. */
	seal: () => void;
}

/**
 * Pure state machine collapsing consecutive identical lines into one row
 * with a repetition counter. Injectable sink and TTY flag keep it testable.
 */
export function createCollapseConsoleWriter({
	write,
	isTTY,
}: CollapseWriterOptions): CollapseConsoleWriter {
	let pendingKey: string | null = null;
	let pendingLine = "";
	let count = 0;

	const seal = () => {
		if (!pendingKey) return;
		if (isTTY) {
			// Terminate the live counter row; the last rendered count stays visible.
			write("\n");
		} else if (count > 1) {
			write(`${renderCount(pendingLine, count, false)}\n`);
		}
		pendingKey = null;
		pendingLine = "";
		count = 0;
	};

	const writeLine = (line: string) => {
		const multiline = line.includes("\n");
		const key = multiline ? null : consoleKeyOf(line);

		if (key !== null && key === pendingKey) {
			count += 1;
			if (isTTY) write(renderCount(pendingLine, count, true));
			return;
		}

		seal();
		if (multiline) {
			write(`${line}\n`);
			return;
		}
		// TTY keeps the row unterminated so repeats can rewrite it in place.
		write(isTTY ? line : `${line}\n`);
		pendingKey = key;
		pendingLine = line;
		count = 1;
	};

	return { write: writeLine, seal };
}

let sharedWriter: CollapseConsoleWriter | null = null;

/**
 * Process-wide shared collapse writer backed by process.stdout. Foreign
 * writers (startup banners, stack traces, anything bypassing this module)
 * seal the current row first so they cannot be overwritten by an in-place
 * counter update.
 */
export function getSharedCollapseConsoleWriter(): CollapseConsoleWriter {
	if (sharedWriter) return sharedWriter;

	const stdout = process.stdout;
	const isTTY = Boolean(stdout.isTTY);
	const originalWrite = stdout.write.bind(stdout);
	let ownWrite = false;

	const write = (chunk: string) => {
		ownWrite = true;
		try {
			originalWrite(chunk);
		} finally {
			ownWrite = false;
		}
	};

	const writer = createCollapseConsoleWriter({ write, isTTY });

	const guardedWrite = (chunk: unknown, ...rest: unknown[]) => {
		if (!ownWrite) writer.seal();
		return (originalWrite as (...args: unknown[]) => boolean)(chunk, ...rest);
	};
	(stdout as unknown as { write: (...args: unknown[]) => boolean }).write = guardedWrite;

	process.once("exit", () => writer.seal());

	sharedWriter = writer;
	return writer;
}
