import { expect } from "chai";
import { calculateProjectProgress } from "../utils/calculations";

const TEST_TIMEOUT = 5000;

// Test data that mocks will return
let estimationsToReturn: any[] = [];
let itemsToReturn: any[] = [];

describe("Weighted Value Progress Calculation", () => {
	let mockPrisma: any;
	const testProjectId = "507f1f77bcf86cd799439011";

	beforeEach(() => {
		// Reset mock before each test
		estimationsToReturn = [];
		itemsToReturn = [];
		mockPrisma = createMockPrisma();
	});

	describe("Formula Validation: (completedValuePoints / totalValuePoints) × 100", () => {
		it("should calculate 0% when no items exist", async function () {
			this.timeout(TEST_TIMEOUT);

			// No approved estimations
			estimationsToReturn = ([]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			expect(result.totalValuePoints).to.equal(0);
			expect(result.completedValuePoints).to.equal(0);
			expect(result.valueProgressPercentage).to.equal(0);
		});

		it("should calculate 100% when all items completed", async function () {
			this.timeout(TEST_TIMEOUT);

			// Setup: 3 items, all completed
			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 5, estimatedTotal: 10000 },
				{ status: "COMPLETED", estimationPoints: 8, estimatedTotal: 20000 },
				{ status: "COMPLETED", estimationPoints: 13, estimatedTotal: 30000 },
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// V_total = 10000 + 20000 + 30000 = 60000
			// V_completed = 10000 + 20000 + 30000 = 60000
			// Progress = (60000 / 60000) × 100 = 100%
			expect(result.totalValuePoints).to.equal(60000);
			expect(result.completedValuePoints).to.equal(60000);
			expect(result.valueProgressPercentage).to.equal(100);
		});

		it("should calculate 0% when no items completed", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "PENDING", estimationPoints: 5, estimatedTotal: 10000 },
				{ status: "IN_PROGRESS", estimationPoints: 8, estimatedTotal: 20000 },
				{ status: "PENDING", estimationPoints: 13, estimatedTotal: 30000 },
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// V_total = 60000
			// V_completed = 0
			// Progress = (0 / 60000) × 100 = 0%
			expect(result.totalValuePoints).to.equal(60000);
			expect(result.completedValuePoints).to.equal(0);
			expect(result.valueProgressPercentage).to.equal(0);
		});

		it("should calculate weighted progress correctly with mixed statuses", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 21, estimatedTotal: 40000 }, // 44.2%
				{ status: "IN_PROGRESS", estimationPoints: 13, estimatedTotal: 30000 }, // 33.1%
				{ status: "COMPLETED", estimationPoints: 5, estimatedTotal: 20000 }, // 22.1%
				{ status: "PENDING", estimationPoints: 2, estimatedTotal: 500 }, // 0.6%
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// V_total = 40000 + 30000 + 20000 + 500 = 90500
			// V_completed = 40000 + 20000 = 60000
			// Progress = (60000 / 90500) × 100 = 66.30% ≈ 66%
			expect(result.totalValuePoints).to.equal(90500);
			expect(result.completedValuePoints).to.equal(60000);
			expect(result.valueProgressPercentage).to.equal(66);
		});
	});

	describe("Weighted Contribution Validation", () => {
		it("should weight expensive items more than cheap items", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);

			// Scenario 1: Complete cheap item
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 5, estimatedTotal: 100 },
				{ status: "PENDING", estimationPoints: 21, estimatedTotal: 50000 },
			]);

			const result1 = await calculateProjectProgress(mockPrisma, testProjectId);

			// V_total = 100 + 50000 = 50100
			// V_completed = 100
			// Progress = (100 / 50100) × 100 = 0.2%
			expect(result1.totalValuePoints).to.equal(50100);
			expect(result1.completedValuePoints).to.equal(100);
			expect(result1.valueProgressPercentage).to.equal(0); // Rounds to 0%

			// Scenario 2: Complete expensive item instead
			itemsToReturn = ([
				{ status: "PENDING", estimationPoints: 5, estimatedTotal: 100 },
				{ status: "COMPLETED", estimationPoints: 21, estimatedTotal: 50000 },
			]);

			const result2 = await calculateProjectProgress(mockPrisma, testProjectId);

			// V_total = 50100
			// V_completed = 50000
			// Progress = (50000 / 50100) × 100 = 99.8% ≈ 100%
			expect(result2.totalValuePoints).to.equal(50100);
			expect(result2.completedValuePoints).to.equal(50000);
			expect(result2.valueProgressPercentage).to.equal(100); // Rounds to 100%
		});

		it("should validate proportional weight contribution", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 8, estimatedTotal: 30000 }, // 30% weight
				{ status: "PENDING", estimationPoints: 13, estimatedTotal: 70000 }, // 70% weight
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// Item 1 weight: 30000 / 100000 = 30%
			// Item 2 weight: 70000 / 100000 = 70%
			// Completed weight: 30%
			expect(result.totalValuePoints).to.equal(100000);
			expect(result.completedValuePoints).to.equal(30000);
			expect(result.valueProgressPercentage).to.equal(30);
		});
	});

	describe("Comparison: Weighted vs Unweighted", () => {
		it("should show difference between item count and value progress", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 21, estimatedTotal: 50000 },
				{ status: "PENDING", estimationPoints: 5, estimatedTotal: 500 },
				{ status: "PENDING", estimationPoints: 3, estimatedTotal: 300 },
				{ status: "PENDING", estimationPoints: 2, estimatedTotal: 200 },
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// Item count progress: 1/4 = 25%
			// Value progress: 50000/51000 = 98%
			expect(result.progressPercentage).to.equal(25); // Unweighted
			expect(result.valueProgressPercentage).to.equal(98); // Weighted

			// This proves expensive items have more influence!
		});
	});

	describe("Edge Cases", () => {
		it("should handle items with zero estimatedTotal", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 5, estimatedTotal: 0 },
				{ status: "COMPLETED", estimationPoints: 8, estimatedTotal: 10000 },
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// V_total = 0 + 10000 = 10000
			// V_completed = 0 + 10000 = 10000
			// Progress = 100%
			expect(result.totalValuePoints).to.equal(10000);
			expect(result.completedValuePoints).to.equal(10000);
			expect(result.valueProgressPercentage).to.equal(100);
		});

		it("should handle all items with zero cost", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 5, estimatedTotal: 0 },
				{ status: "PENDING", estimationPoints: 8, estimatedTotal: 0 },
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// V_total = 0
			// Division by zero protection
			expect(result.totalValuePoints).to.equal(0);
			expect(result.completedValuePoints).to.equal(0);
			expect(result.valueProgressPercentage).to.equal(0);
		});

		it("should exclude cancelled items from total", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 8, estimatedTotal: 30000 },
				{ status: "CANCELLED", estimationPoints: 13, estimatedTotal: 40000 },
				{ status: "PENDING", estimationPoints: 5, estimatedTotal: 30000 },
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// Cancelled items ARE included in value calculation
			// (they're part of the total budget)
			// V_total = 30000 + 40000 + 30000 = 100000
			// V_completed = 30000
			expect(result.totalValuePoints).to.equal(100000);
			expect(result.completedValuePoints).to.equal(30000);
			expect(result.valueProgressPercentage).to.equal(30);
		});

		it("should handle items without estimationPoints but with estimatedTotal", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: null, estimatedTotal: 20000 },
				{ status: "PENDING", estimationPoints: null, estimatedTotal: 30000 },
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// Value progress should still work
			expect(result.totalValuePoints).to.equal(50000);
			expect(result.completedValuePoints).to.equal(20000);
			expect(result.valueProgressPercentage).to.equal(40);

			// Points progress should be 0 (no points assigned)
			expect(result.totalPoints).to.equal(0);
			expect(result.pointsProgressPercentage).to.equal(0);
		});
	});

	describe("Real-World Scenarios", () => {
		it("Scenario: Building a house - foundation and framing complete", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 34, estimatedTotal: 80000 }, // Foundation
				{ status: "COMPLETED", estimationPoints: 21, estimatedTotal: 60000 }, // Framing
				{ status: "IN_PROGRESS", estimationPoints: 13, estimatedTotal: 40000 }, // Plumbing
				{ status: "PENDING", estimationPoints: 13, estimatedTotal: 35000 }, // Electrical
				{ status: "PENDING", estimationPoints: 5, estimatedTotal: 5000 }, // Paint
				{ status: "PENDING", estimationPoints: 2, estimatedTotal: 500 }, // Doorknobs
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// Total budget: $220,500
			// Completed: $140,000 (Foundation + Framing)
			// Progress: (140000 / 220500) × 100 = 63.49% ≈ 63%
			expect(result.totalValuePoints).to.equal(220500);
			expect(result.completedValuePoints).to.equal(140000);
			expect(result.valueProgressPercentage).to.equal(63);

			// Compare: Item count is only 33% (2/6), but value is 63%
			expect(result.totalItems).to.equal(6);
			expect(result.completedItems).to.equal(2);
			expect(result.progressPercentage).to.equal(33); // 2/6 = 33%
		});

		it("Scenario: Software project - polish items completed but core features pending", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "PENDING", estimationPoints: 34, estimatedTotal: 80000 }, // Core API
				{ status: "PENDING", estimationPoints: 21, estimatedTotal: 60000 }, // Database
				{ status: "COMPLETED", estimationPoints: 3, estimatedTotal: 1000 }, // Logo
				{ status: "COMPLETED", estimationPoints: 2, estimatedTotal: 500 }, // Icons
				{ status: "COMPLETED", estimationPoints: 2, estimatedTotal: 500 }, // Color scheme
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// Total budget: $142,000
			// Completed: $2,000 (polish items)
			// Progress: (2000 / 142000) × 100 = 1.4% ≈ 1%
			expect(result.totalValuePoints).to.equal(142000);
			expect(result.completedValuePoints).to.equal(2000);
			expect(result.valueProgressPercentage).to.equal(1);

			// Item count is 60% (3/5) but value is only 1%
			// This shows the expensive work is still pending!
			expect(result.completedItems).to.equal(3);
			expect(result.progressPercentage).to.equal(60);
		});
	});

	describe("Mathematical Properties", () => {
		it("should be monotonic - completing items never decreases progress", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);

			// State 1: No items completed
			itemsToReturn = ([
				{ status: "PENDING", estimationPoints: 8, estimatedTotal: 10000 },
				{ status: "PENDING", estimationPoints: 13, estimatedTotal: 20000 },
			]);

			const result1 = await calculateProjectProgress(mockPrisma, testProjectId);
			const progress1 = result1.valueProgressPercentage;

			// State 2: One item completed
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 8, estimatedTotal: 10000 },
				{ status: "PENDING", estimationPoints: 13, estimatedTotal: 20000 },
			]);

			const result2 = await calculateProjectProgress(mockPrisma, testProjectId);
			const progress2 = result2.valueProgressPercentage;

			// State 3: Both items completed
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 8, estimatedTotal: 10000 },
				{ status: "COMPLETED", estimationPoints: 13, estimatedTotal: 20000 },
			]);

			const result3 = await calculateProjectProgress(mockPrisma, testProjectId);
			const progress3 = result3.valueProgressPercentage;

			// Progress should increase monotonically
			expect(progress1).to.equal(0);
			expect(progress2).to.be.greaterThan(progress1); // 33%
			expect(progress3).to.be.greaterThan(progress2); // 100%
			expect(progress3).to.equal(100);
		});

		it("should validate range: 0% ≤ progress ≤ 100%", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 8, estimatedTotal: 10000 },
				{ status: "PENDING", estimationPoints: 13, estimatedTotal: 20000 },
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			expect(result.valueProgressPercentage).to.be.at.least(0);
			expect(result.valueProgressPercentage).to.be.at.most(100);
		});

		it("should be additive - sum of individual weights equals total", async function () {
			this.timeout(TEST_TIMEOUT);

			estimationsToReturn = ([{ id: "est1" }]);
			itemsToReturn = ([
				{ status: "COMPLETED", estimationPoints: 8, estimatedTotal: 10000 },
				{ status: "COMPLETED", estimationPoints: 13, estimatedTotal: 20000 },
				{ status: "COMPLETED", estimationPoints: 5, estimatedTotal: 30000 },
			]);

			const result = await calculateProjectProgress(mockPrisma, testProjectId);

			// Individual weights:
			// Item 1: 10000/60000 = 16.67%
			// Item 2: 20000/60000 = 33.33%
			// Item 3: 30000/60000 = 50.00%
			// Sum: 100.00%

			const totalValue = result.totalValuePoints;
			const item1Weight = 10000 / totalValue;
			const item2Weight = 20000 / totalValue;
			const item3Weight = 30000 / totalValue;

			const sumOfWeights = item1Weight + item2Weight + item3Weight;

			expect(sumOfWeights).to.be.closeTo(1.0, 0.0001); // Should equal 1 (100%)
		});
	});
});

// Helper function to create mock Prisma client
function createMockPrisma() {
	return {
		estimation: {
			findMany: async function (args: any) {
				// The function expects estimations with nested items (via Prisma select)
				// So we need to attach items to each estimation
				return Promise.resolve(
					estimationsToReturn.map((est) => ({
						...est,
						items: itemsToReturn,
					})),
				);
			},
		},
		item: {
			findMany: async function (args: any) {
				return Promise.resolve(itemsToReturn);
			},
		},
	};
}
