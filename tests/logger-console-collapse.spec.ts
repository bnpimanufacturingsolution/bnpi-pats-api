import { expect } from "chai";
import {
	CLEAR_EOL,
	DIM,
	RESET,
	consoleKeyOf,
	createCollapseConsoleWriter,
	durationBucket,
} from "../helper/console-collapse";
import { consoleLineFormat } from "../helper/logger";

function buildWriter(isTTY: boolean, sink: string[]) {
	return createCollapseConsoleWriter({
		write: (chunk: string) => sink.push(chunk),
		isTTY,
	});
}

describe("console collapse writer", () => {
	describe("consoleKeyOf", () => {
		it("strips the leading HH:mm:ss timestamp so a rolling clock keeps counters alive", () => {
			expect(
				consoleKeyOf("10:46:34 INFO Request completed GET /api/v1/health 200 10ms"),
			).to.equal("INFO Request completed GET /api/v1/health 200 10ms");
		});

		it("leaves lines without a timestamp prefix untouched", () => {
			expect(consoleKeyOf("plain line")).to.equal("plain line");
		});
	});

	describe("durationBucket", () => {
		it("rounds sub-second timings to 10ms buckets", () => {
			expect(durationBucket("12ms")).to.equal("10ms");
			expect(durationBucket("8ms")).to.equal("10ms");
			expect(durationBucket("123ms")).to.equal("120ms");
			expect(durationBucket("0ms")).to.equal("1ms");
		});

		it("switches to 100ms-granularity seconds above one second", () => {
			expect(durationBucket("1000ms")).to.equal("1s");
			expect(durationBucket("1500ms")).to.equal("1.5s");
			expect(durationBucket("2450ms")).to.equal("2.5s");
		});

		it("passes unparsable input through and drops non-string input", () => {
			expect(durationBucket("abc")).to.equal("abc");
			expect(durationBucket(123)).to.equal("");
			expect(durationBucket(undefined)).to.equal("");
		});
	});

	describe("TTY output", () => {
		it("counts consecutive identical lines in place, sealing before different output", () => {
			const sink: string[] = [];
			const writer = buildWriter(true, sink);
			const counter = (count: number) =>
				`\r12:00:00 INFO A${DIM} (×${count})${RESET}${CLEAR_EOL}`;

			writer.write("12:00:00 INFO A");
			writer.write("12:00:01 INFO A");
			writer.write("12:00:02 INFO A");
			writer.write("12:00:03 INFO B");

			expect(sink).to.deep.equal([
				"12:00:00 INFO A",
				counter(2),
				counter(3),
				"\n",
				"12:00:03 INFO B",
			]);
		});

		it("does not collapse lines that differ beyond their timestamp", () => {
			const sink: string[] = [];
			const writer = buildWriter(true, sink);

			writer.write("12:00:00 INFO GET /a 200 10ms");
			writer.write("12:00:01 INFO GET /b 200 20ms");

			expect(sink).to.deep.equal(["12:00:00 INFO GET /a 200 10ms", "\n", "12:00:01 INFO GET /b 200 20ms"]);
		});

		it("prints multiline output plainly and never makes it pending", () => {
			const sink: string[] = [];
			const writer = buildWriter(true, sink);
			const multiline = "12:00:00 ERROR EXCEPTION: boom\nStack: fake";

			writer.write("12:00:00 INFO A");
			writer.write(multiline);
			writer.write(multiline.replace("12:00:00", "12:00:01"));

			expect(sink).to.deep.equal(["12:00:00 INFO A", "\n", `${multiline}\n`, `${multiline.replace("12:00:00", "12:00:01")}\n`]);
		});
	});

	describe("piped (non-TTY) output", () => {
		it("prints the first occurrence, then one summary with the final count on seal", () => {
			const sink: string[] = [];
			const writer = buildWriter(false, sink);

			writer.write("12:00:00 INFO A");
			writer.write("12:00:01 INFO A");
			writer.write("12:00:02 INFO A");
			writer.write("12:00:03 INFO B");

			expect(sink).to.deep.equal([
				"12:00:00 INFO A\n",
				"12:00:00 INFO A (×3)\n",
				"12:00:03 INFO B\n",
			]);
		});

		it("leaves a single occurrence as exactly one plain line", () => {
			const sink: string[] = [];
			const writer = buildWriter(false, sink);

			writer.write("12:00:00 INFO A");
			writer.write("12:00:01 INFO B");

			expect(sink).to.deep.equal(["12:00:00 INFO A\n", "12:00:01 INFO B\n"]);
		});
	});
});

describe("console line format", () => {
	it("renders request metadata inline and keeps the exact duration out of the collapse jitter", () => {
		const transformed = consoleLineFormat.transform(
			{
				level: "info",
				message: "Request completed",
				method: "GET",
				path: "/api/v1/health",
				statusCode: 200,
				duration: "12ms",
				requestId: "9f1c8e5a-0000-4000-8000-000000000000",
				timestamp: new Date("2026-09-11T02:46:34Z").toISOString(),
			},
			{},
		) as { consoleLine?: string; consoleKey?: string };

		expect(transformed.consoleLine).to.match(
			/^\d{2}:\d{2}:\d{2} INFO Request completed GET \/api\/v1\/health 200 10ms$/,
		);
		expect(transformed.consoleKey).to.equal(
			"INFO Request completed GET /api/v1/health 200 10ms",
		);
	});

	it("does not render request context for logs without method/path metadata", () => {
		const transformed = consoleLineFormat.transform(
			{
				level: "warn",
				message: "Redis not connected, skipping cache",
				module: "cache-manager",
				timestamp: new Date("2026-09-11T02:46:34Z").toISOString(),
			},
			{},
		) as { consoleLine?: string };

		expect(transformed.consoleLine).to.match(
			/^\d{2}:\d{2}:\d{2} WARN \[cache-manager\] Redis not connected, skipping cache$/,
		);
	});
});
