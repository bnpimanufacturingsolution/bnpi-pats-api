/**
 * Code Generator Helper
 * Utility functions for generating codes from names
 */

/**
 * Generate a code prefix from a name
 * Takes the first letter + next consonants to make the specified length
 *
 * @param name - The name to generate code from
 * @param length - The desired code length (default: 3)
 * @returns The generated code prefix (uppercase)
 *
 * @example
 * generateCodeFromName("OKADA") // "OKD"
 * generateCodeFromName("Materials") // "MTR"
 * generateCodeFromName("Labor") // "LBR"
 * generateCodeFromName("Equipment") // "EQP"
 * generateCodeFromName("Samsung", 4) // "SMSG"
 */
export const generateCodeFromName = (name: string, length: number = 3): string => {
	const upperName = name.toUpperCase().replace(/[^A-Z]/g, "");
	if (upperName.length === 0) return "X".repeat(length);

	const vowels = ["A", "E", "I", "O", "U"];
	let code = upperName[0]; // Always include first letter

	// Add consonants until we reach desired length
	for (let i = 1; i < upperName.length && code.length < length; i++) {
		if (!vowels.includes(upperName[i])) {
			code += upperName[i];
		}
	}

	// If still not enough chars, add remaining letters (including vowels)
	for (let i = 1; i < upperName.length && code.length < length; i++) {
		if (!code.includes(upperName[i])) {
			code += upperName[i];
		}
	}

	// Pad with X if still not enough characters
	return code.padEnd(length, "X");
};
