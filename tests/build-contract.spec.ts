import fs from "node:fs";
import path from "node:path";
import { expect } from "chai";

const repositoryRoot = path.resolve(__dirname, "..");

function readRepositoryFile(fileName: string): string {
	return fs.readFileSync(path.join(repositoryRoot, fileName), "utf8");
}

describe("production build contract", () => {
	it("starts the JavaScript production artifact", () => {
		const packageJson = JSON.parse(readRepositoryFile("package.json"));

		expect(packageJson.scripts.prod).to.equal("node dist/server.js");
	});

	it("emits dist/server.js from Webpack", () => {
		const webpackConfig = readRepositoryFile("webpack.config.js");

		expect(webpackConfig).to.match(/filename:\s*["']server\.js["']/);
	});

	it("uses port 3000 across local API configuration and nginx", () => {
		const envExample = readRepositoryFile(".env.example");
		const nginxConfig = readRepositoryFile("nginx.conf");

		expect(envExample).to.match(/^PORT=3000$/m);
		expect(nginxConfig).to.match(/server app:3000;/);
	});

	it("uses pnpm and the checked-in lockfile in Docker", () => {
		const dockerfile = readRepositoryFile("Dockerfile");

		expect(dockerfile).to.match(/corepack enable/);
		expect(dockerfile).to.match(/pnpm install --frozen-lockfile/);
		expect(dockerfile).to.match(/COPY .*pnpm-lock\.yaml \.\//);
		expect(dockerfile).not.to.match(/npm ci/);
	});
});
