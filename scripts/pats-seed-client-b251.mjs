/**
 * Client-evidence catalog fragment for PATS seed.
 * Source: bnpi-pats-app/.wwg/references/client-parts-list/
 * Workbook: PL B251 Machibouke Hamburger Shop 3 (Rev 6.0)
 *
 * Contour families (PROVISIONAL — not Drive-approved publication):
 * - Inj/Assy physical parts: B251-01-*
 * - Deco part nos (Deco tab DECO PART NO.): B251-01-*S / *ST (linked to inj)
 * - Paint nos (Deco tab PAINT NO.): PN-B251-*
 * - Shared capsule (ALL MODELS): C002-01-42
 *
 * Model 05 name conflict (Cola vs Ice Coffee) is preserved as NEEDS_CONFIRMATION.
 * Paint process / full Deco matrix are intentionally not modeled as domain entities.
 */

export const CLIENT_B251 = {
	productCode: "B251",
	productName: "Machibouke Hamburger Shop 3",
	workbookTitle: "PL B251 Machibouke Hamburger Shop 3 (Rev 6.0).xlsx",
	revision: "Rev. 6.0",
	formCode: "BNPI-F-PES-018-1",
	trayQuantityStandard: 240,
	models: [
		{
			modelNumber: "01",
			modelName: "Avocado Burger",
			sourceStatus: "SOURCE_ALIGNED",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B251-01-01", "Avocado Burger Upper Bun"],
				["B251-01-02", "Slice Avocado"],
				["B251-01-03", "Tomato"],
				["B251-01-04", "Cheese & Patty"],
				["B251-01-05", "Lettuce"],
				["B251-01-06", "Avocado Burger Lower Bun"],
				["B251-01-07", "Hands & Feet"],
			],
		},
		{
			modelNumber: "02",
			modelName: "Cheese Hotdog",
			sourceStatus: "SOURCE_ALIGNED",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B251-01-08", "Cheese Hotdog Bread"],
				["B251-01-09", "Hands & Feet"],
				["B251-01-10", "Cheese Hotdog"],
			],
		},
		{
			modelNumber: "03",
			modelName: "Tacos",
			sourceStatus: "SOURCE_ALIGNED",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B251-01-11", "Left Taco"],
				["B251-01-12", "Right Taco"],
				["B251-01-13", "Hands & Feet L"],
				["B251-01-14", "Hands & Feet R"],
			],
		},
		{
			modelNumber: "04",
			modelName: "Potato Wedge",
			sourceStatus: "SOURCE_ALIGNED",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B251-01-15", "Fries"],
				["B251-01-16", "Body"],
				["B251-01-17", "Hands & Feet"],
			],
		},
		{
			// Conflict: Inj/Inj Shot = Cola; Deco = ICE COFFEE; Assy mixed.
			modelNumber: "05",
			modelName: "Cola / Ice Coffee",
			sourceStatus: "NEEDS_CONFIRMATION",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B251-01-18", "Straw"],
				["B251-01-19", "Cap"],
				["B251-01-20", "Ice L"],
				["B251-01-21", "Ice R"],
				["B251-01-22", "Cup"],
			],
			nameConflict: {
				Inj: "Cola",
				"Inj Shot": "Cola",
				Deco: "ICE COFFEE",
				Assy: ["Cola", "Ice Coffee"],
			},
		},
		{
			modelNumber: "06",
			modelName: "Tray",
			sourceStatus: "SOURCE_ALIGNED",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B251-01-23", "Tray"],
				["B251-01-24", "Hands & Feet"],
			],
		},
	],

	/** Packaging reference shared across all models (Inj/Assy tabs). */
	sharedCapsule: {
		partCode: "C002-01-42",
		partName: "Ø 48 mm Transparent Eco Capsule",
		scope: "ALL_MODELS",
		sourceTabs: ["Inj", "Assy"],
	},

	/**
	 * Decoration-tab DECO PART NO. rows (column D), linked to INJ. PART NO. (column F).
	 * Skip upsert when partCode already exists as an inj part on the same model.
	 */
	decoPartsByModel: {
		"01": [
			{ partCode: "B251-01-01ST", partName: "Avocado Burger Upper Bun", injPartCode: "B251-01-01", decoProcess: "ST" },
			{ partCode: "B251-01-02S", partName: "Slice Avocado", injPartCode: "B251-01-02", decoProcess: "S" },
			{ partCode: "B251-01-03S", partName: "Tomato", injPartCode: "B251-01-03", decoProcess: "S" },
			{ partCode: "B251-01-04S", partName: "Cheese & Patty", injPartCode: "B251-01-04", decoProcess: "S" },
			{ partCode: "B251-01-05S", partName: "Lettuce", injPartCode: "B251-01-05", decoProcess: "S" },
			{ partCode: "B251-01-06S", partName: "Avocado Burger Lower Bun", injPartCode: "B251-01-06", decoProcess: "S" },
			{ partCode: "B251-01-07S", partName: "Hands & Feet", injPartCode: "B251-01-07", decoProcess: "S" },
		],
		"02": [
			{ partCode: "B251-01-08S", partName: "Cheese Hotdog Bread", injPartCode: "B251-01-08", decoProcess: "S" },
			{ partCode: "B251-01-09S", partName: "Hands and Feet", injPartCode: "B251-01-09", decoProcess: "S" },
			{ partCode: "B251-01-10S", partName: "Cheese Hotdog", injPartCode: "B251-01-10", decoProcess: "S" },
		],
		"03": [
			{ partCode: "B251-01-11S", partName: "Left Taco", injPartCode: "B251-01-11", decoProcess: "S" },
			{ partCode: "B251-01-12S", partName: "Right Taco", injPartCode: "B251-01-12", decoProcess: "S" },
			{ partCode: "B251-01-13S", partName: "Hands & Feet L", injPartCode: "B251-01-13", decoProcess: "S" },
			{ partCode: "B251-01-14S", partName: "Hands & Feet R", injPartCode: "B251-01-14", decoProcess: "S" },
		],
		"04": [
			{ partCode: "B251-01-15S", partName: "Fries", injPartCode: "B251-01-15", decoProcess: "S" },
			{ partCode: "B251-01-16ST", partName: "Body", injPartCode: "B251-01-16", decoProcess: "ST" },
			{ partCode: "B251-01-17S", partName: "Hands & Feet", injPartCode: "B251-01-17", decoProcess: "S" },
		],
		"05": [
			// Bare codes match inj identity — seed skips duplicate ModelPart rows.
			{ partCode: "B251-01-18", partName: "Straw", injPartCode: "B251-01-18", decoProcess: null },
			{ partCode: "B251-01-19", partName: "Cap", injPartCode: "B251-01-19", decoProcess: null },
			{ partCode: "B251-01-22", partName: "Cup", injPartCode: "B251-01-22", decoProcess: null },
			{ partCode: "B251-01-20S", partName: "Ice L", injPartCode: "B251-01-20", decoProcess: "S" },
			{ partCode: "B251-01-21S", partName: "Ice R", injPartCode: "B251-01-21", decoProcess: "S" },
		],
		"06": [
			{ partCode: "B251-01-23S", partName: "Tray", injPartCode: "B251-01-23", decoProcess: "S" },
			{ partCode: "B251-01-24S", partName: "Hands & Feet", injPartCode: "B251-01-24", decoProcess: "S" },
		],
	},

	/**
	 * Unique Decoration-tab PAINT NO. values (column J) with first-seen color/feature.
	 * modelNumbers = models where the paint no. appears under that group header.
	 */
	paintNumbers: [
		{ partCode: "PN-B251-01", paintColor: "Yellowish White", featureName: "Upper Bun", modelNumbers: ["01", "02", "03"] },
		{ partCode: "PN-B251-02", paintColor: "Brown", featureName: "Toast", modelNumbers: ["01"] },
		{ partCode: "PN-B251-03A", paintColor: "Light Cream", featureName: "Sesame Seeds", modelNumbers: ["01"] },
		{ partCode: "PN-B251-04", paintColor: "Light Green", featureName: "Slice Avocado", modelNumbers: ["01"] },
		{ partCode: "PN-B251-05", paintColor: "Red", featureName: "Tomato", modelNumbers: ["01"] },
		{ partCode: "PN-B251-06", paintColor: "Dark Yellow", featureName: "Jalapeno Sauce", modelNumbers: ["01", "02"] },
		{ partCode: "PN-B251-07", paintColor: "Dark Brown", featureName: "Patty 1", modelNumbers: ["01"] },
		{ partCode: "PN-B251-08", paintColor: "Dark Brown", featureName: "Front", modelNumbers: ["02"] },
		{ partCode: "PN-B251-10", paintColor: "Orange", featureName: "Jalapeno Hotdog", modelNumbers: ["02"] },
		{ partCode: "PN-B251-11", paintColor: "Brown", featureName: "Hands & Feet R Side", modelNumbers: ["03"] },
		{ partCode: "PN-B251-12", paintColor: "Green Yellow", featureName: "Letuce L & R", modelNumbers: ["03"] },
		{ partCode: "PN-B251-13", paintColor: "Brown", featureName: "Meat L & R", modelNumbers: ["03"] },
		{ partCode: "PN-B251-14", paintColor: "Red", featureName: "Tomato", modelNumbers: ["03"] },
		{ partCode: "PN-B251-15", paintColor: "Yellowish White", featureName: "Hands & Feet R Side", modelNumbers: ["03"] },
		{ partCode: "PN-B251-16", paintColor: "Yellow", featureName: "Fries", modelNumbers: ["04"] },
		{ partCode: "PN-B251-17", paintColor: "Orange", featureName: "Feet L/R", modelNumbers: ["04"] },
		{ partCode: "PN-B251-18A", paintColor: "White", featureName: "Lining R", modelNumbers: ["04"] },
		{ partCode: "PN-B251-19", paintColor: "Transparent Brown", featureName: "Ice L & Ice R", modelNumbers: ["05"] },
		{ partCode: "PN-B251-20", paintColor: "Dark Brown", featureName: "Tray", modelNumbers: ["06"] },
		{ partCode: "PN-B251-21", paintColor: "Dark Brown", featureName: "Hands & Feet", modelNumbers: ["06"] },
		{ partCode: "PN-B251-22", paintColor: "Transparent", featureName: "Slice Avocado", modelNumbers: ["01", "02"] },
	],
};

/** Display name for a deco part no. (honest contour label, not a process claim). */
export function decoPartDisplayName(deco) {
	const suffix = deco.decoProcess ? ` (deco ${deco.decoProcess})` : " (deco)";
	return `${deco.partName}${suffix}`;
}

/** Display name for a paint number catalog row. */
export function paintPartDisplayName(paint) {
	const color = paint.paintColor ? ` · ${paint.paintColor}` : "";
	const feature = paint.featureName ? ` · ${paint.featureName}` : "";
	return `Paint ${paint.partCode}${color}${feature}`;
}
