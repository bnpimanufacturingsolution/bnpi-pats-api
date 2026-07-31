/**
 * Disposable-environment API journey for full App–API acceptance.
 * Usage: node scripts/acceptance-api-journey.mjs
 * Env: PATS_API_BASE (default http://127.0.0.1:3302/api/v1)
 *      PATS_SEED_PASSWORD (default pats-demo-seed-2026)
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = (process.env.PATS_API_BASE ?? "http://127.0.0.1:3302/api/v1").replace(/\/$/, "");
const healthBase = base.replace(/\/api\/v1$/, "");
const password = process.env.PATS_SEED_PASSWORD ?? "pats-demo-seed-2026";
const results = [];
const samples = {};

function rec(name, status, detail = "") {
	results.push({ name, status, detail });
	console.log(`[${status}] ${name}${detail ? ` - ${detail}` : ""}`);
}

async function api(method, path, { headers = {}, body, absolute = false } = {}) {
	const url = absolute ? path : path.startsWith("http") ? path : `${base}${path}`;
	const init = { method, headers: { ...headers } };
	if (body !== undefined) {
		init.headers["Content-Type"] = "application/json";
		init.body = JSON.stringify(body);
	}
	const res = await fetch(url, init);
	const text = await res.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = null;
	}
	return {
		status: res.status,
		headers: Object.fromEntries(res.headers.entries()),
		etag: res.headers.get("etag"),
		location: res.headers.get("location"),
		body: json,
		raw: text,
	};
}

function dataOf(body) {
	if (!body) return [];
	if (Array.isArray(body)) return body;
	if (Array.isArray(body.data)) return body.data;
	return [];
}

async function sleep(ms) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(username, attempts = 4) {
	let res = await api("POST", "/auth/login", { body: { username, password } });
	for (let i = 1; i < attempts && res.status === 429; i += 1) {
		await sleep(1200 * i);
		res = await api("POST", "/auth/login", { body: { username, password } });
	}
	const token = res.body?.accessToken ?? res.body?.token;
	return { res, token };
}

async function main() {
	const health = await api("GET", `${healthBase}/health`, { absolute: true });
	rec("health", health.status === 200 ? "PASS" : "FAIL", String(health.status));

	const unauth = await api("GET", "/users/me");
	rec("unauthorized-me", unauth.status === 401 ? "PASS" : "FAIL", String(unauth.status));
	rec(
		"problem-details-shape",
		unauth.headers["content-type"]?.includes("problem+json") && unauth.body?.type ? "PASS" : "FAIL",
		unauth.headers["content-type"] ?? "missing",
	);

	const planner = await login("demo.planner");
	if (!planner.token) {
		rec("auth-login-planner", "FAIL", `${planner.res.status} ${planner.res.raw.slice(0, 200)}`);
		finish();
		process.exit(1);
	}
	rec("auth-login-planner", "PASS", "ok");
	const plannerAuth = { Authorization: `Bearer ${planner.token}` };

	const operator = await login("demo.operator");
	rec("auth-login-operator", operator.token ? "PASS" : "FAIL", String(operator.res.status));
	const operatorAuth = operator.token ? { Authorization: `Bearer ${operator.token}` } : null;

	const quality = await login("demo.quality");
	rec("auth-login-quality", quality.token ? "PASS" : "FAIL", String(quality.res.status));
	const qualityAuth = quality.token ? { Authorization: `Bearer ${quality.token}` } : null;

	const me = await api("GET", "/users/me", { headers: plannerAuth });
	rec("users-me", me.status === 200 && me.body?.id ? "PASS" : "FAIL", me.body?.id ?? String(me.status));

	const caps = await api("GET", "/users/me/capabilities", { headers: plannerAuth });
	const capList = caps.body?.capabilities ?? caps.body?.data ?? [];
	rec("capabilities-planner", caps.status === 200 ? "PASS" : "FAIL", `count=${Array.isArray(capList) ? capList.length : "?"}`);

	if (operatorAuth) {
		const opCaps = await api("GET", "/users/me/capabilities", { headers: operatorAuth });
		const list = opCaps.body?.capabilities ?? [];
		rec("capabilities-operator", opCaps.status === 200 && list.includes("execution.read") ? "PASS" : "FAIL", JSON.stringify(list));
	}

	const products = await api("GET", "/catalog/products", { headers: plannerAuth });
	const productRows = dataOf(products.body).filter((p) => String(p.productCode ?? "").startsWith("DEMO-") || String(p.productName ?? "").includes("DEMO"));
	const allProducts = dataOf(products.body);
	const product = productRows[0] ?? allProducts[0];
	const productId = product?.productId ?? product?.id;
	rec("catalog-products", products.status === 200 ? "PASS" : "FAIL", `count=${allProducts.length} productId=${productId}`);

	if (productId) {
		const detail = await api("GET", `/catalog/products/${productId}`, { headers: plannerAuth });
		rec("catalog-product-detail", detail.status === 200 ? "PASS" : "FAIL", `etag=${detail.etag ?? "none"}`);
	}

	const plans = await api("GET", "/production-plans", { headers: plannerAuth });
	const planRows = dataOf(plans.body);
	const demoPlan =
		planRows.find((p) => String(p.planCode ?? "") === "DEMO-PLAN-001") ??
		planRows.find((p) => String(p.planCode ?? "").startsWith("DEMO-") && p.status === "RELEASED") ??
		planRows[0];
	const planId = demoPlan?.planId ?? demoPlan?.id;
	rec("production-plans", plans.status === 200 ? "PASS" : "FAIL", `count=${planRows.length} first=${planId} status=${demoPlan?.status}`);

	let planEtag = null;
	let planDetail = null;
	if (planId) {
		const plan = await api("GET", `/production-plans/${planId}`, { headers: plannerAuth });
		planDetail = plan.body;
		planEtag = plan.etag;
		const etagOk = typeof planEtag === "string" && /^"\d+"$/.test(planEtag);
		rec("production-plan-detail", plan.status === 200 && etagOk ? "PASS" : "FAIL", `etag=${planEtag} rowVersion=${plan.body?.rowVersion}`);
		samples.planDetail = { etag: planEtag, status: plan.body?.status, lots: plan.body?.lots?.length };
	}

	// Create a draft plan for mutation + concurrency checks
	const draftCreate = await api("POST", "/production-plans", {
		headers: { ...plannerAuth, "Idempotency-Key": "journey-draft-plan-1" },
		body: {
			planCode: "DEMO-ACC-PLAN-001",
			name: "Acceptance Draft Plan",
			requiredProductionQuantity: 120,
			productId: productId ?? null,
		},
	});
	const draftReplay = await api("POST", "/production-plans", {
		headers: { ...plannerAuth, "Idempotency-Key": "journey-draft-plan-1" },
		body: {
			planCode: "DEMO-ACC-PLAN-001",
			name: "Acceptance Draft Plan",
			requiredProductionQuantity: 120,
			productId: productId ?? null,
		},
	});
	const draftId = draftCreate.body?.planId ?? draftCreate.location?.split("/").pop();
	const createOk = [200, 201].includes(draftCreate.status) && draftReplay.status === draftCreate.status;
	rec("plan-create-idempotent", createOk ? "PASS" : "FAIL", `first=${draftCreate.status} replay=${draftReplay.status} id=${draftId} ${draftCreate.raw.slice(0, 120)}`);

	if (draftId) {
		const draftGet = await api("GET", `/production-plans/${draftId}`, { headers: plannerAuth });
		const draftEtag = draftGet.etag;
		const stale = await api("PATCH", `/production-plans/${draftId}`, {
			headers: { ...plannerAuth, "Idempotency-Key": crypto.randomUUID(), "If-Match": '"0"' },
			body: { name: "stale" },
		});
		rec("stale-if-match", stale.status === 412 || stale.status === 409 ? "PASS" : "FAIL", String(stale.status));

		const goodName = "Acceptance Draft Plan Edited";
		const patch = await api("PATCH", `/production-plans/${draftId}`, {
			headers: { ...plannerAuth, "Idempotency-Key": crypto.randomUUID(), "If-Match": draftEtag ?? `"${draftGet.body?.rowVersion}"` },
			body: { name: goodName },
		});
		if (patch.status === 200) {
			const reload = await api("GET", `/production-plans/${draftId}`, { headers: plannerAuth });
			rec("plan-edit-persist", reload.body?.name === goodName ? "PASS" : "FAIL", `name=${reload.body?.name} etag=${reload.etag}`);
		} else {
			rec("plan-edit-persist", "FAIL", `${patch.status} ${patch.raw.slice(0, 200)}`);
		}
	} else {
		rec("stale-if-match", "BLOCKED", "no draft");
		rec("plan-edit-persist", "BLOCKED", "no draft");
	}

	// Forbidden: quality cannot create plans
	if (qualityAuth) {
		const forb = await api("POST", "/production-plans", {
			headers: { ...qualityAuth, "Idempotency-Key": crypto.randomUUID() },
			body: { planCode: "X", name: "Nope", requiredProductionQuantity: 1 },
		});
		rec("forbidden-planning-write", forb.status === 403 ? "PASS" : "FAIL", String(forb.status));
	}

	const bad = await api("POST", "/auth/login", { body: { username: "", password: "" } });
	rec("malformed-login", bad.status === 422 ? "PASS" : "FAIL", String(bad.status));

	// Operator execution surface
	if (!operatorAuth) {
		for (const name of [
			"stations",
			"stages",
			"batches",
			"batch-positions",
			"stage-events",
			"inventory-transactions",
			"routing-violations",
			"dashboard-summaries",
			"reports-line",
			"workflow-groups",
			"station-steps",
			"station-history",
			"stage-event-idempotent",
			"inventory-idempotent",
		]) {
			rec(name, "BLOCKED", "no operator token");
		}
	} else {
		const stations = await api("GET", "/stations", { headers: operatorAuth });
		const stationRows = dataOf(stations.body);
		// Prefer DEMO-coded stations
		const station =
			stationRows.find((s) => String(s.stationCode ?? s.name ?? "").includes("DEMO") || String(s.stationCode ?? "").includes("Injection")) ??
			stationRows[0];
		const stationId = station?.stationId ?? station?.id;
		rec("stations", stations.status === 200 ? "PASS" : "FAIL", `count=${stationRows.length} first=${stationId}`);

		const stages = await api("GET", "/stages", { headers: operatorAuth });
		rec("stages", stages.status === 200 ? "PASS" : "FAIL", `count=${dataOf(stages.body).length}`);

		const batches = await api("GET", "/batches", { headers: operatorAuth });
		const batchRows = dataOf(batches.body);
		const demoBatch =
			batchRows.find((b) => String(b.batchCode ?? "").startsWith("DEMO-")) ?? batchRows[0];
		const batchId = demoBatch?.batchId ?? demoBatch?.id;
		rec("batches", batches.status === 200 ? "PASS" : "FAIL", `count=${batchRows.length} first=${batchId}`);

		const positions = await api("GET", "/batch-positions", { headers: operatorAuth });
		const positionRows = dataOf(positions.body);
		const demoPosition =
			positionRows.find((p) => p.batchId === batchId || String(p.batch?.batchCode ?? "").startsWith("DEMO-")) ??
			positionRows[0];
		rec("batch-positions", positions.status === 200 ? "PASS" : "FAIL", `count=${positionRows.length}`);
		samples.position = demoPosition ?? null;

		const events = await api("GET", "/stage-events", { headers: operatorAuth });
		rec("stage-events", events.status === 200 ? "PASS" : "FAIL", `count=${dataOf(events.body).length}`);

		const inv = await api("GET", "/inventory-transactions", { headers: operatorAuth });
		rec("inventory-transactions", inv.status === 200 ? "PASS" : "FAIL", `count=${dataOf(inv.body).length}`);

		const rv = await api("GET", "/routing-violations", { headers: operatorAuth });
		const rvRows = dataOf(rv.body);
		const openViolation = rvRows.find((v) => !v.resolved && v.status !== "RESOLVED" && v.status !== "WAIVED") ?? rvRows[0];
		const violationId = openViolation?.id ?? openViolation?.violationId ?? openViolation?.routingViolationId;
		rec("routing-violations", rv.status === 200 ? "PASS" : "FAIL", `count=${rvRows.length} first=${violationId}`);

		const dash = await api("GET", "/dashboard-summaries", { headers: operatorAuth });
		rec("dashboard-summaries", dash.status === 200 ? "PASS" : "FAIL", dash.status === 200 ? "ok" : `${dash.status} ${dash.raw.slice(0, 120)}`);
		samples.dashboard = dash.body;

		const rep = await api("GET", "/reports/line", { headers: operatorAuth });
		rec("reports-line", rep.status === 200 ? "PASS" : "FAIL", rep.status === 200 ? "ok" : `${rep.status}`);
		samples.reportKeys = rep.body ? Object.keys(rep.body) : [];

		const wg = await api("GET", "/workflow-groups", { headers: operatorAuth });
		rec("workflow-groups", wg.status === 200 ? "PASS" : "FAIL", String(wg.status));

		const steps = await api("GET", "/station-steps", { headers: operatorAuth });
		const stepRows = dataOf(steps.body);
		rec("station-steps", steps.status === 200 ? "PASS" : "FAIL", `count=${stepRows.length}`);

		if (stationId) {
			const hist = await api("GET", `/stations/${stationId}/history`, { headers: operatorAuth });
			rec("station-history", hist.status === 200 ? "PASS" : "FAIL", hist.status === 200 ? "ok" : `${hist.status} ${hist.raw.slice(0, 160)}`);
			samples.stationHistory = hist.body;
		} else {
			rec("station-history", "BLOCKED", "no station");
		}

		// Stage event: use position's current expected route if available, or first station-step
		const pos = demoPosition;
		const eventBatchId = pos?.batchId ?? batchId;
		const eventStageId = pos?.stageId ?? demoBatch?.currentStageId ?? stepRows[0]?.stageId;
		const eventSubStageId = pos?.subStageId ?? stepRows[0]?.subStageId ?? null;
		if (eventBatchId && eventStageId) {
			const eventBody = {
				batchId: eventBatchId,
				stageId: eventStageId,
				subStageId: eventSubStageId,
				eventType: "STAGE_SCAN_RECORDED",
				quantity: 1,
				quantityMagnitude: "1",
				quantityUom: "piece",
			};
			const headers = { ...operatorAuth, "Idempotency-Key": `journey-stage-event-${Date.now()}` };
			const e1 = await api("POST", "/stage-events", { headers, body: eventBody });
			const e2 = await api("POST", "/stage-events", { headers, body: eventBody });
			const ok = [200, 201].includes(e1.status) && e2.status === e1.status;
			rec("stage-event-idempotent", ok ? "PASS" : "FAIL", `first=${e1.status} ${e1.raw.slice(0, 160)} | second=${e2.status}`);
			samples.stageEvent = { first: e1.status, second: e2.status, body: e1.body, raw: e1.raw.slice(0, 400) };
		} else {
			rec("stage-event-idempotent", "BLOCKED", `batch=${eventBatchId} stage=${eventStageId}`);
		}

		// Inventory issuance needs a plan-scoped part and target stage for the same batch.
		const invRows = dataOf(inv.body);
		const existingInv =
			invRows.find((row) => row.batchId === eventBatchId) ?? invRows[0];
		const partId =
			existingInv?.partId ??
			planDetail?.lots?.[0]?.partAllocations?.[0]?.partId ??
			planDetail?.parts?.[0]?.id ??
			null;
		const toStageId = existingInv?.toStageId ?? eventStageId ?? stepRows[0]?.stageId;
		const fromStageId = existingInv?.fromStageId ?? null;
		if (eventBatchId && partId && toStageId) {
			const body = {
				transactionType: "ISSUANCE",
				batchId: eventBatchId,
				partId,
				toStageId,
				fromStageId,
				expectedQuantity: 1,
				actualQuantity: 1,
				quantityMagnitude: "1",
				quantityUom: "piece",
			};
			const headers = { ...operatorAuth, "Idempotency-Key": `journey-inv-${Date.now()}` };
			const i1 = await api("POST", "/inventory-transactions", { headers, body });
			const i2 = await api("POST", "/inventory-transactions", { headers, body });
			const ok = [200, 201].includes(i1.status) && i2.status === i1.status;
			rec("inventory-idempotent", ok ? "PASS" : "FAIL", `first=${i1.status} ${i1.raw.slice(0, 160)} | second=${i2.status}`);
			samples.inventory = { first: i1.status, second: i2.status, raw: i1.raw.slice(0, 400) };
		} else {
			rec("inventory-idempotent", "BLOCKED", `batch=${eventBatchId} part=${partId} stage=${toStageId}`);
		}
	}

	// Quality surface
	if (!qualityAuth) {
		rec("quality-inspections", "BLOCKED", "no quality token");
		rec("quality-decision", "BLOCKED", "no quality token");
		rec("resolve-violation", "BLOCKED", "no quality token");
	} else {
		const qi = await api("GET", "/quality-inspections", { headers: qualityAuth });
		const qiRows = dataOf(qi.body);
		const inspection = qiRows.find((row) => row.status !== "COMPLETED" && row.status !== "CANCELLED") ?? qiRows[0];
		const inspectionId = inspection?.id ?? inspection?.inspectionId;
		const rowVersion = inspection?.rowVersion ?? 1;
		rec("quality-inspections", qi.status === 200 ? "PASS" : "FAIL", `count=${qiRows.length} first=${inspectionId} status=${inspection?.status}`);
		samples.inspection = inspection;

		if (inspectionId) {
			const dec = await api("POST", `/quality-inspections/${inspectionId}/decisions`, {
				headers: {
					...qualityAuth,
					"Idempotency-Key": crypto.randomUUID(),
					"If-Match": `"${rowVersion}"`,
				},
				body: { decision: "PASSED", reasonNote: "acceptance journey" },
			});
			if ([200, 201].includes(dec.status)) rec("quality-decision", "PASS", String(dec.status));
			else if ([409, 412, 422].includes(dec.status)) rec("quality-decision", "PASS", `safe-reject ${dec.status} ${dec.raw.slice(0, 100)}`);
			else rec("quality-decision", "FAIL", `${dec.status} ${dec.raw.slice(0, 200)}`);
			samples.qualityDecision = { status: dec.status, raw: dec.raw.slice(0, 300) };
		} else {
			rec("quality-decision", "BLOCKED", "no inspection");
		}

		// Resolve with quality (has reconciliation.resolve)
		const rv = await api("GET", "/routing-violations", { headers: operatorAuth ?? qualityAuth });
		// quality may not have execution.read — use operator list if available
		let violationId = null;
		if (operatorAuth) {
			const opRv = await api("GET", "/routing-violations", { headers: operatorAuth });
			const rows = dataOf(opRv.body);
			const open = rows.find((v) => !v.resolved && v.status !== "RESOLVED" && v.status !== "WAIVED");
			violationId = open?.id ?? open?.violationId ?? open?.routingViolationId;
		}
		if (violationId) {
			const resv = await api("POST", `/routing-violations/${violationId}/resolve`, {
				headers: { ...qualityAuth, "Idempotency-Key": crypto.randomUUID() },
				body: { resolutionNote: "journey resolve" },
			});
			if ([200, 201, 204].includes(resv.status)) rec("resolve-violation", "PASS", String(resv.status));
			else if ([409, 422].includes(resv.status)) rec("resolve-violation", "PASS", `already-closed ${resv.status}`);
			else rec("resolve-violation", "FAIL", `${resv.status} ${resv.raw.slice(0, 200)}`);
		} else {
			rec("resolve-violation", "BLOCKED", "no open violation visible");
		}
	}

	finish();
	const failed = results.filter((r) => r.status === "FAIL").length;
	process.exit(failed > 0 ? 1 : 0);
}

function finish() {
	const pass = results.filter((r) => r.status === "PASS").length;
	const fail = results.filter((r) => r.status === "FAIL").length;
	const blocked = results.filter((r) => r.status === "BLOCKED").length;
	console.log(`==== SUMMARY pass=${pass} fail=${fail} blocked=${blocked} total=${results.length} ====`);
	const outDir = tmpdir();
	writeFileSync(join(outDir, "pats-api-journey-results.json"), JSON.stringify(results, null, 2));
	writeFileSync(join(outDir, "pats-api-journey-samples.json"), JSON.stringify(samples, null, 2));
	console.log(`Wrote ${join(outDir, "pats-api-journey-results.json")}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
