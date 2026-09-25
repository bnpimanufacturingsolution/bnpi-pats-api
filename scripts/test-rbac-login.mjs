const users = [
	{ username: "liza.delacruz", expectedRole: "admin" },
	{ username: "marco.villanueva", expectedRole: "planner" },
	{ username: "joshua.reyes", expectedRole: "operator" },
	{ username: "aila.torres", expectedRole: "operator (line leader)" },
	{ username: "karen.limjoco", expectedRole: "qi" },
	{ username: "paolo.garcia", expectedRole: "qi (no scope)" },
];

const password = "pats-demo-seed-2026";
const base = "http://localhost:3000/api/v1";

async function testAuth() {
	console.log("Testing PATS API live authentication...\n");

	for (const u of users) {
		const loginRes = await fetch(`${base}/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: u.username, password }),
		});

		const loginData = await loginRes.json();
		if (!loginRes.ok) {
			console.log(`❌ Login FAILED for ${u.username}: ${loginRes.status} ${JSON.stringify(loginData)}`);
			continue;
		}

		console.log(`✅ Login SUCCESS for ${u.username} (${u.expectedRole})`);
		console.log(`   Token type: ${loginData.tokenType}, Expires in: ${loginData.expiresIn}s`);

		// Test self-profile / identity projection
		const meRes = await fetch(`${base}/users/me`, {
			headers: { Authorization: `Bearer ${loginData.accessToken}` },
		});
		const meData = await meRes.json();
		if (!meRes.ok) {
			console.log(`   ⚠️ /users/me returned ${meRes.status}: ${JSON.stringify(meData)}`);
		} else {
			console.log(`   Display Name: ${meData.displayName}`);
			console.log(`   Subject ID:   ${meData.id}`);
		}

		const capsRes = await fetch(`${base}/users/me/capabilities`, {
			headers: { Authorization: `Bearer ${loginData.accessToken}` },
		});
		const capsData = await capsRes.json();
		if (!capsRes.ok) {
			console.log(`   ⚠️ /users/me/capabilities returned ${capsRes.status}: ${JSON.stringify(capsData)}`);
		} else {
			console.log(`   Capabilities (${capsData.capabilities?.length}): ${capsData.capabilities?.join(", ")}`);
		}
		console.log("");
	}
}

testAuth().catch(console.error);
