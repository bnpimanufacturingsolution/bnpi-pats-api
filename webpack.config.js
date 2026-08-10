const path = require("path");

module.exports = {
	entry: "./index.ts",
	target: "node",
	externals: [
		function ({ context, request }, callback) {
			// Exclude node_modules
			if (/^[a-z\-0-9]+$/.test(request)) {
				return callback(null, "commonjs " + request);
			}
			// Exclude Prisma Client and rewrite generated/prisma paths
			if (request === "@prisma/client") {
				return callback(null, "commonjs " + request);
			}
			// Rewrite generated/prisma paths to be relative to dist folder
			if (request.includes("generated/prisma")) {
				return callback(null, "commonjs ./generated/prisma");
			}
			if (request.includes("generated/pats-client")) {
				return callback(null, "commonjs ./generated/pats-client");
			}
			callback();
		},
	],
	output: {
		filename: "server.js", // output file
		path: path.join(__dirname, "dist"),
		libraryTarget: "commonjs",
	},
	resolve: {
		// Add in `.ts` and `.tsx` as a resolvable extension.
		extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js", ".json", ".yaml"],
		// TS's node16/nodenext module resolution requires explicit ".js"
		// specifiers on relative imports of ".ts" source files; resolve those
		// back to the real ".ts" file here.
		extensionAlias: {
			".js": [".ts", ".js"],
		},
		modules: ["./node_modules", "node_modules"],
	},
	resolveLoader: {
		//root: [`${root}/node_modules`],
	},
	module: {
		rules: [
			{
				// all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
				test: /\.tsx?$/,
				use: [
					{
						loader: "ts-loader",
					},
				],
			},
		],
	},
};
