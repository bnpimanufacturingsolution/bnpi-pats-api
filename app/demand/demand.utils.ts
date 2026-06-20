import { Product } from "../../generated/prisma";

export type DemandProductSnapshotSource = Pick<
	Product,
	| "id"
	| "code"
	| "name"
	| "description"
	| "brand"
	| "category"
	| "variant"
	| "unitOfMeasure"
	| "revision"
	| "status"
	| "tags"
	| "metadata"
>;

export function normalizeDemandPlanCode(code: string): string {
	return code.trim().toUpperCase();
}

export function generateDemandPlanCode(
	existingCodes: string[],
	periodStart: Date,
): { code: string; prefix: string; number: number } {
	const year = periodStart.getFullYear();
	const month = String(periodStart.getMonth() + 1).padStart(2, "0");
	const prefix = `DMD-${year}${month}-`;
	const matchingNumbers = existingCodes
		.map((code) => code.toUpperCase())
		.filter((code) => code.startsWith(prefix))
		.map((code) => Number.parseInt(code.slice(prefix.length), 10))
		.filter((value) => Number.isFinite(value) && value > 0);

	const number = matchingNumbers.length > 0 ? Math.max(...matchingNumbers) + 1 : 1;

	return {
		code: `${prefix}${String(number).padStart(3, "0")}`,
		prefix,
		number,
	};
}

export function getNextNumericSequence(values: Array<number | null | undefined>): number {
	const numericValues = values.filter(
		(value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
	);

	return numericValues.length > 0 ? Math.max(...numericValues) + 1 : 1;
}

export function buildProductSnapshot(product: DemandProductSnapshotSource) {
	return {
		id: product.id,
		code: product.code,
		name: product.name,
		description: product.description,
		brand: product.brand,
		category: product.category,
		variant: product.variant,
		unitOfMeasure: product.unitOfMeasure,
		revision: product.revision,
		status: product.status,
		tags: product.tags,
		metadata: product.metadata,
	};
}
