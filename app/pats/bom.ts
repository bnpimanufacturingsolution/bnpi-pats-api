import type { Request, Response } from "express";
import type { PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import { CanonicalEvidenceSubjectType } from "../../generated/pats-client";
import {
	buildOffsetPage,
	parseOffsetPagination,
	parseSort,
	type SortField,
} from "../canonical/collection";
import { toBomDefinitionResource, toBomLineResource } from "./bom-foundation";

type BomReadDatabase = Pick<
	PatsPrismaClient,
	"bomDefinition" | "canonicalEvidenceLink"
>;

const BOM_DEFINITION_SORT_FIELDS = ["revision", "created_at", "updated_at"] as const;
const BOM_DEFINITION_SORT_COLUMNS: Record<string, string> = {
	revision: "revision",
	created_at: "createdAt",
	updated_at: "updatedAt",
	id: "id",
};

function requestInstance(req: Request): string {
	return req.originalUrl.split("?", 1)[0];
}

function sendProblem(
	req: Request,
	res: Response,
	status: number,
	type: string,
	title: string,
	detail: string,
): void {
	res.type("application/problem+json").status(status).json({
		type,
		title,
		status,
		detail,
		instance: requestInstance(req),
	});
}

function sendMalformedQuery(req: Request, res: Response): void {
	sendProblem(
		req,
		res,
		400,
		"urn:bandai:pats:problem:malformed-request",
		"Bad Request",
		"The BOM definition collection query is invalid.",
	);
}

async function sourceEvidenceCount(
	database: BomReadDatabase,
	subjectId: string,
): Promise<number> {
	return database.canonicalEvidenceLink.count({
		where: {
			subjectType: CanonicalEvidenceSubjectType.BOM_DEFINITION,
			subjectId,
		},
	});
}

async function lineSourceEvidenceCount(
	database: BomReadDatabase,
	subjectId: string,
): Promise<number> {
	return database.canonicalEvidenceLink.count({
		where: {
			subjectType: CanonicalEvidenceSubjectType.BOM_LINE,
			subjectId,
		},
	});
}

export function catalogBomDefinitionCollectionController(database: BomReadDatabase) {
	return async (req: Request, res: Response): Promise<void> => {
		res.setHeader("Cache-Control", "no-store");
		const query = req.query as Record<string, string | string[] | undefined>;
		const modelId = query.model_id;
		const pagination = parseOffsetPagination({ page: query.page, limit: query.limit });
		const sortQuery = query.sort;
		const sorting = Array.isArray(sortQuery)
			? { ok: false as const, problemType: "urn:bandai:pats:problem:malformed-request", status: 400 as const }
			: parseSort(sortQuery, BOM_DEFINITION_SORT_FIELDS);
		const unsupportedQueryKey = Object.keys(query).find(
			(key) => !["model_id", "page", "limit", "sort"].includes(key),
		);

		if (
			unsupportedQueryKey ||
			Array.isArray(modelId) ||
			typeof modelId !== "string" ||
			modelId.trim() === "" ||
			"ok" in pagination ||
			"ok" in sorting
		) {
			sendMalformedQuery(req, res);
			return;
		}

		const orderBy = (sorting as SortField[]).map(({ field, direction }) => ({
			[BOM_DEFINITION_SORT_COLUMNS[field]]: direction,
		}));

		try {
			const [totalItems, definitions] = await Promise.all([
				database.bomDefinition.count({ where: { modelId } }),
				database.bomDefinition.findMany({
					where: { modelId },
					skip: (pagination.page - 1) * pagination.limit,
					take: pagination.limit,
					orderBy: orderBy as never,
					select: {
						id: true,
						modelId: true,
						revision: true,
						lifecycleStatus: true,
						evidenceStatus: true,
						rowVersion: true,
						createdAt: true,
						updatedAt: true,
					},
				}),
			]);

			const data = await Promise.all(
				definitions.map(async (definition) =>
					toBomDefinitionResource(
						definition,
						await sourceEvidenceCount(database, definition.id),
					),
				),
			);

			res.type("application/json").status(200).json(buildOffsetPage(data, pagination, totalItems));
		} catch {
			sendProblem(
				req,
				res,
				503,
				"urn:bandai:pats:problem:dependency-unavailable",
				"Dependency Unavailable",
				"PATS BOM definition data is unavailable.",
			);
		}
	};
}

export function catalogBomDefinitionController(database: BomReadDatabase) {
	return async (req: Request, res: Response): Promise<void> => {
		res.setHeader("Cache-Control", "no-store");

		try {
			const definition = await database.bomDefinition.findUnique({
				where: { id: req.params.bomDefinitionId },
				select: {
					id: true,
					modelId: true,
					revision: true,
					lifecycleStatus: true,
					evidenceStatus: true,
					rowVersion: true,
					createdAt: true,
					updatedAt: true,
					lines: {
						orderBy: { lineNumber: "asc" },
						select: {
							id: true,
							bomDefinitionId: true,
							modelPartId: true,
							lineNumber: true,
							relationshipKind: true,
							quantityMagnitude: true,
							quantityUom: true,
							usageBasis: true,
							sourceRepresentation: true,
							lifecycleStatus: true,
							evidenceStatus: true,
							rowVersion: true,
							createdAt: true,
							updatedAt: true,
						},
					},
				},
			});

			if (!definition) {
				sendProblem(
					req,
					res,
					404,
					"urn:bandai:pats:problem:not-found",
					"Not Found",
					"The requested BOM definition was not found.",
				);
				return;
			}

			const [definitionEvidenceCount, lines] = await Promise.all([
				sourceEvidenceCount(database, definition.id),
				Promise.all(
					definition.lines.map(async (line) =>
						toBomLineResource(line, await lineSourceEvidenceCount(database, line.id)),
					),
				),
			]);

			res.type("application/json").status(200).json({
				...toBomDefinitionResource(definition, definitionEvidenceCount),
				lines,
			});
		} catch {
			sendProblem(
				req,
				res,
				503,
				"urn:bandai:pats:problem:dependency-unavailable",
				"Dependency Unavailable",
				"PATS BOM definition data is unavailable.",
			);
		}
	};
}
