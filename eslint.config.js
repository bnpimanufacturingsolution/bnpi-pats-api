const eslintConfigPrettier = require("eslint-config-prettier");
const parser = require("@typescript-eslint/parser");

module.exports = [
	eslintConfigPrettier,
	{
		files: ["app/**/*.ts", "index.ts"],
		languageOptions: {
			parserOptions: {
				ecmaVersion: 2018,
				sourceType: "module",
			},
			parser: parser,
		},
		ignores: [],
	},
	// Prettier disabled in ESLint - run prettier separately if needed
];
