import { controller } from "../app/invoice/invoice.controller";
import { expect } from "chai";
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";

const TEST_TIMEOUT = 5000;

describe("Invoice Controller", () => {
	let invoiceController: any;
	let req: Partial<Request>;
	let res: Response;
	let next: NextFunction;
	let prisma: any;
	let sentData: any;
	let statusCode: number;

	const mockInvoice = {
		id: "507f1f77bcf86cd799439301",
		invoiceNumber: "INV-2025-001",
		workspaceId: "507f1f77bcf86cd799439001",
		invoiceType: "PAYABLE",
		purchaseOrderId: "507f1f77bcf86cd799439101",
		deliveryOrderId: "507f1f77bcf86cd799439201",
		vendorId: "507f1f77bcf86cd799439051",
		projectId: "507f1f77bcf86cd799439010",
		partyName: "TechSupply Global Inc.",
		partyAddress: "123 Tech Street, Manila",
		partyContact: "+63-2-123-4567",
		partyEmail: "accounts@techsupply.com",
		invoiceDate: new Date("2025-02-20"),
		dueDate: new Date("2025-03-22"),
		paidDate: null,
		items: [
			{
				itemId: "507f1f77bcf86cd799439201",
				description: "Dell Latitude 7430 Laptop",
				quantity: 10,
				unitPrice: 1200.00,
				totalPrice: 12000.00,
				taxable: true,
				remarks: null
			}
		],
		subtotal: 12000.00,
		taxPercentage: 12,
		taxAmount: 1440.00,
		discountAmount: 0,
		totalAmount: 13440.00,
		currency: "PHP",
		paidAmount: 0,
		balanceDue: 13440.00,
		paymentTerms: "Net 30",
		paymentRecords: [],
		status: "SENT",
		remarks: "Please process payment before due date",
		documentUrls: [],
		sentAt: new Date("2025-02-20"),
		acknowledgedAt: null,
		acknowledgedBy: null,
		isDeleted: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockInvoices = [
		mockInvoice,
		{
			...mockInvoice,
			id: "507f1f77bcf86cd799439302",
			invoiceNumber: "INV-2025-002",
			status: "DRAFT",
		},
		{
			...mockInvoice,
			id: "507f1f77bcf86cd799439303",
			invoiceNumber: "INV-2025-003",
			status: "PAID",
			paidAmount: 13440.00,
			balanceDue: 0,
		},
	];

	beforeEach(() => {
		prisma = {
			invoice: {
				findMany: async (_params: Prisma.InvoiceFindManyArgs) => {
					if (req.query?.groupBy) {
						return mockInvoices;
					}
					return [mockInvoice];
				},
				count: async (_params: Prisma.InvoiceCountArgs) => {
					if (req.query?.groupBy) {
						return mockInvoices.length;
					}
					return 1;
				},
				findFirst: async (params: Prisma.InvoiceFindFirstArgs) =>
					params.where?.id === mockInvoice.id ? mockInvoice : null,
				findUnique: async (params: Prisma.InvoiceFindUniqueArgs) =>
					params.where?.id === mockInvoice.id ? mockInvoice : null,
				create: async (params: Prisma.InvoiceCreateArgs) => ({
					...mockInvoice,
					...params.data,
				}),
				update: async (params: Prisma.InvoiceUpdateArgs) => ({
					...mockInvoice,
					...params.data,
				}),
				delete: async (params: Prisma.InvoiceDeleteArgs) => ({
					...mockInvoice,
					id: params.where.id,
				}),
			},
			$transaction: async (operations: any) => {
				if (typeof operations === "function") {
					return operations(prisma);
				}
				return await Promise.all(operations);
			},
		};

		invoiceController = controller(prisma as PrismaClient);
		sentData = undefined;
		statusCode = 200;
		req = {
			query: {},
			params: {},
			body: {},
			get: (header: string) => {
				if (header === "Content-Type") {
					return "application/json";
				}
				return undefined;
			},
			originalUrl: "/api/invoice",
		} as Request;
		res = {
			send: (data: any) => {
				sentData = data;
				return res;
			},
			status: (code: number) => {
				statusCode = code;
				return res;
			},
			json: (data: any) => {
				sentData = data;
				return res;
			},
			end: () => res,
		} as Response;
		next = ((err: any) => {
			if (err) {
				if (err.message && err.message.includes("not found")) {
					statusCode = 404;
					sentData = { status: "error", message: err.message, code: 404 };
				} else if (err.message && (err.message.includes("Missing") || err.message.includes("Invalid") || err.message.includes("required"))) {
					statusCode = 400;
					sentData = { status: "error", message: err.message, code: 400 };
				} else {
					statusCode = 500;
					sentData = { status: "error", message: err.message || "Internal server error", code: 500 };
				}
			}
		}) as NextFunction;
	});

	describe(".getAll()", () => {
		it("should return paginated invoices", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "1", limit: "10", document: "true" };
			await invoiceController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
		});

		it("should group invoices by status field", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { groupBy: "status", document: "true" };
			await invoiceController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData.data).to.have.property("invoices");
			expect(sentData.data).to.have.property("groupedBy", "status");
		});

		it("should handle query validation failure", async function () {
			this.timeout(TEST_TIMEOUT);
			req.query = { page: "invalid", document: "true" };
			await invoiceController.getAll(req as Request, res, next);
			expect(statusCode).to.equal(400);
			expect(sentData).to.have.property("status", "error");
		});
	});

	describe(".getById()", () => {
		it("should return an invoice", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockInvoice.id };
			await invoiceController.getById(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.deep.include({ id: mockInvoice.id });
		});

		it("should handle invalid ID format", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "invalid-id" };
			await invoiceController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
		});

		it("should handle non-existent invoice", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await invoiceController.getById(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".create()", () => {
		it("should create a new invoice", async function () {
			this.timeout(TEST_TIMEOUT);
			const createData = {
				invoiceNumber: "INV-2025-004",
				invoiceType: "PAYABLE",
				vendorId: "507f1f77bcf86cd799439051",
				items: [
					{
						description: "HP Monitor 27\"",
						quantity: 5,
						unitPrice: 500,
						totalPrice: 2500,
						taxable: true,
					}
				],
				subtotal: 2500,
				totalAmount: 2800,
			};
			req.body = createData;
			await invoiceController.create(req as Request, res, next);
			expect(statusCode).to.equal(201);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("id");
		});
	});

	describe(".update()", () => {
		it("should update invoice details", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = {
				status: "PAID",
				paidAmount: 13440.00,
				balanceDue: 0,
			};
			req.params = { id: mockInvoice.id };
			req.body = updateData;
			await invoiceController.update(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
			expect(sentData).to.have.property("data");
			expect(sentData.data).to.have.property("invoice");
		});

		it("should handle non-existent invoice update", async function () {
			this.timeout(TEST_TIMEOUT);
			const updateData = { status: "CANCELLED" };
			req.params = { id: "507f1f77bcf86cd799439999" };
			req.body = updateData;
			await invoiceController.update(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});

	describe(".remove()", () => {
		it("should delete an invoice", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: mockInvoice.id };
			await invoiceController.remove(req as Request, res, next);
			expect(statusCode).to.equal(200);
			expect(sentData).to.have.property("status", "success");
		});

		it("should handle non-existent invoice deletion", async function () {
			this.timeout(TEST_TIMEOUT);
			req.params = { id: "507f1f77bcf86cd799439999" };
			await invoiceController.remove(req as Request, res, next);
			expect(statusCode).to.equal(404);
			expect(sentData).to.have.property("status", "error");
			expect(sentData).to.have.property("code", 404);
		});
	});
});
