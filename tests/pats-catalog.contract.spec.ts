import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { expect } from "chai";
import { patsModule } from "../app/pats";
import { ObjectStorageNotFoundError, type ObjectStorage } from "../app/storage/object-storage";

const workspaceId = "507f1f77bcf86cd799439011";
const productId = "product-b251";

type ProductRecord = {
	id: string;
	productCode: string;
	productName: string;
	createdAt: Date;
	updatedAt: Date;
	models: Array<{
		id: string;
		productId: string;
		modelNumber: string;
		modelName: string | null;
		sourceStatus: "source-aligned" | "needs-confirmation" | "manual";
		sourceReference: Record<string, unknown> | null;
		skuCode: string;
		pinned: boolean;
		updatedAt: Date;
		modelParts: Array<{
			id: string;
			modelId: string;
			partCode: string;
			partName: string;
			routingSteps: unknown;
		}>;
	}>;
};

function makeApp(
	product: ProductRecord | null,
	storage: ObjectStorage,
	options: { storageError?: Error } = {},
) {
	const findFirst = async (args: { where?: unknown }) => {
		expect(args.where).to.deep.equal({
			id: productId,
			projects: { some: { workspaceId } },
		});
		if (options.storageError) throw options.storageError;
		return product;
	};

	const workspaceAccess = (req: Request, _res: Response, next: NextFunction) => {
		expect(req.headers["x-workspace-id"]).to.equal(workspaceId);
		(req as Request & { userId?: string }).userId = "test-user";
		next();
	};

	const app = express();
	app.use(
		patsModule(
			{
				patsPrisma: { product: { findFirst } } as never,
				objectStorage: storage,
				workspaceAccess,
			},
		),
	);
	return app;
}

function makeStorage(overrides: Partial<ObjectStorage> = {}): ObjectStorage {
	return {
		putObject: async () => {
			throw new Error("not used");
		},
		getObject: async () => {
			throw new Error("not used");
		},
		deleteObject: async () => undefined,
		createReadUrl: async () => "https://minio.invalid/pats-private/read-url",
		...overrides,
	};
}

function completeProduct(): ProductRecord {
	const timestamp = new Date("2026-07-13T00:00:00.000Z");
	return {
		id: productId,
		productCode: "B251",
		productName: "Machibouke Hamburger Shop",
		createdAt: timestamp,
		updatedAt: timestamp,
		models: [
			{
				id: "model-01",
				productId,
				modelNumber: "01",
				modelName: "Hamburger",
				sourceStatus: "source-aligned",
				sourceReference: {
					workbookTitle: "B251 source workbook",
					revision: "r3",
					modelNamesByTab: { Inj: "Hamburger", Deco: "Hamburger" },
				},
				skuCode: "B251-01",
				pinned: true,
				updatedAt: timestamp,
				modelParts: [
					{
						id: "model-part-01",
						modelId: "model-01",
						partCode: "BODY",
						partName: "Body",
						routingSteps: [{ stageId: "stage-injection", subStageId: null }],
					},
				],
			},
		],
	};
}

describe("PATS catalog read contract", () => {
	it("returns a complete Product -> Model -> ModelPart record scoped to the workspace", async () => {
		const app = makeApp(completeProduct(), makeStorage());

		const response = await request(app)
			.get(`/pats/catalog/products/${productId}`)
			.set("x-workspace-id", workspaceId);

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.equal({
			success: true,
			data: {
				productId,
				productCode: "B251",
				productName: "Machibouke Hamburger Shop",
				createdAt: "2026-07-13T00:00:00.000Z",
				updatedAt: "2026-07-13T00:00:00.000Z",
				models: [
					{
						modelId: "model-01",
						productId,
						modelNumber: "01",
						modelName: "Hamburger",
						sourceStatus: "source-aligned",
						sourceReference: {
							workbookTitle: "B251 source workbook",
							revision: "r3",
							modelNamesByTab: { Inj: "Hamburger", Deco: "Hamburger" },
						},
						skuCode: "B251-01",
						imageUrl: null,
						pinned: true,
						updatedAt: "2026-07-13T00:00:00.000Z",
						modelParts: [
							{
								modelPartId: "model-part-01",
								modelId: "model-01",
								partCode: "BODY",
								partName: "Body",
								routingSteps: [{ stageId: "stage-injection", subStageId: null }],
							},
						],
					},
				],
			},
		});
	});

	it("returns sparse records with null source metadata, empty collections, and no image fallback", async () => {
		const sparse = completeProduct();
		sparse.models = [
			{
				...sparse.models[0],
				modelName: null,
				sourceReference: null,
				modelParts: [],
			},
		];

		const app = makeApp(sparse, makeStorage());
		const response = await request(app)
			.get(`/pats/catalog/products/${productId}`)
			.set("x-workspace-id", workspaceId);

		expect(response.status).to.equal(200);
		expect(response.body.data.models[0]).to.include({
			modelName: null,
			sourceReference: null,
			imageUrl: null,
		});
		expect(response.body.data.models[0].modelParts).to.deep.equal([]);
	});

	it("turns a missing optional private image into imageUrl null", async () => {
		const sparse = completeProduct();
		sparse.models[0].sourceReference = { imageObjectKey: "pats/models/model-01.png" };
		const app = makeApp(
			sparse,
			makeStorage({ createReadUrl: async () => { throw new ObjectStorageNotFoundError("missing"); } }),
		);

		const response = await request(app)
			.get(`/pats/catalog/products/${productId}`)
			.set("x-workspace-id", workspaceId);

		expect(response.status).to.equal(200);
		expect(response.body.data.models[0].imageUrl).to.equal(null);
	});

	it("returns an explicit storage-unavailable response", async () => {
		const sparse = completeProduct();
		sparse.models[0].sourceReference = { imageObjectKey: "pats/models/model-01.png" };
		const app = makeApp(
			sparse,
			makeStorage({ createReadUrl: async () => { throw new Error("MinIO unavailable"); } }),
		);

		const response = await request(app)
			.get(`/pats/catalog/products/${productId}`)
			.set("x-workspace-id", workspaceId);

		expect(response.status).to.equal(503);
		expect(response.body).to.include({
			success: false,
			code: 503,
			errorCode: "PATS_IMAGE_STORAGE_UNAVAILABLE",
		});
		expect(response.body.message).to.equal(
			"The catalog service is temporarily unavailable. Please try again later.",
		);
		expect(JSON.stringify(response.body)).to.not.contain("MinIO unavailable");
	});

	it("returns explicit not-found and workspace-validation responses", async () => {
		const notFoundApp = makeApp(null, makeStorage());
		const notFound = await request(notFoundApp)
			.get(`/pats/catalog/products/${productId}`)
			.set("x-workspace-id", workspaceId);

		expect(notFound.status).to.equal(404);
		expect(notFound.body).to.include({ success: false, code: 404 });

		const invalidWorkspace = await request(notFoundApp)
			.get(`/pats/catalog/products/${productId}`)
			.set("x-workspace-id", "not-a-workspace");

		expect(invalidWorkspace.status).to.equal(400);
	});
});
