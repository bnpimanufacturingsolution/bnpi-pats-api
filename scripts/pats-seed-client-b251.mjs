/**
 * Client-evidence catalog fragment for PATS seed.
 * Source: bnpi-pats-app/.wwg/references/client-parts-list/
 * Workbook: PL B251 Machibouke Hamburger Shop 3 (Rev 6.0)
 *
 * This is REFERENCE/PROVISIONAL seed material — not Drive-approved publication.
 * Model 05 name conflict (Cola vs Ice Coffee) is preserved as NEEDS_CONFIRMATION.
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
			// Seed keeps both labels in sourceReference; display uses dual label.
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
	sharedCapsule: {
		partNumber: "C002-01-42",
		partName: "Ø 48 mm Transparent Eco Capsule",
		model: "ALL MODELS",
	},
};
