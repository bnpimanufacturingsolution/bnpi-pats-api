/**
 * Second PROVISIONAL catalog fragment for disposable seed variety.
 *
 * Not Drive-approved client publication. Shape mirrors BNPI capsule-line
 * parts-list practice (product / model / part codes) so demos show more than
 * one SKU family without inventing policy.
 */

export const CLIENT_B308 = {
	productCode: "B308",
	productName: "Street Food Friends",
	revision: "Rev. 2.1",
	formCode: "BNPI-F-PES-018-3",
	trayQuantityStandard: 200,
	models: [
		{
			modelNumber: "01",
			modelName: "Takoyaki",
			sourceStatus: "SOURCE_ALIGNED",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B308-01-01", "Takoyaki Shell"],
				["B308-01-02", "Octopus Bit"],
				["B308-01-03", "Sauce Cap"],
				["B308-01-04", "Hands & Feet"],
			],
		},
		{
			modelNumber: "02",
			modelName: "Ramen Cup",
			sourceStatus: "SOURCE_ALIGNED",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B308-01-05", "Cup Body"],
				["B308-01-06", "Noodle Ring"],
				["B308-01-07", "Chopstick Pair"],
			],
		},
		{
			modelNumber: "03",
			modelName: "Onigiri",
			sourceStatus: "SOURCE_ALIGNED",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B308-01-08", "Rice Body"],
				["B308-01-09", "Nori Wrap"],
				["B308-01-10", "Filling Plug"],
			],
		},
		{
			modelNumber: "04",
			modelName: "Yakitori Skewer",
			sourceStatus: "SOURCE_ALIGNED",
			evidenceStatus: "PROVISIONAL",
			parts: [
				["B308-01-11", "Skewer Stick"],
				["B308-01-12", "Chicken Piece"],
				["B308-01-13", "Sauce Drop"],
			],
		},
	],
	sharedCapsule: {
		partCode: "C002-01-48",
		partName: "Ø 50 mm Clear Eco Capsule",
		scope: "ALL_MODELS",
	},
};
