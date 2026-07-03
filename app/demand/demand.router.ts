import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validate, validateObjectId } from "../../middleware/validate";
import { transformFormData } from "../../middleware/transformFormData";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";
import { requireWorkspaceRole } from "../../middleware/workspaceAuth";
import {
	CreateDemandPlanSchema,
	UpdateDemandPlanSchema,
	CreateDemandLineSchema,
	UpdateDemandLineSchema,
	CreateDemandEstimateVersionSchema,
	UpdateDemandEstimateVersionSchema,
	CreateProjectConversionSchema,
} from "../../zod/demand.zod";

const READ_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
const WRITE_ROLES = ["OWNER", "ADMIN", "MEMBER"];
const DELETE_ROLES = ["OWNER", "ADMIN"];

interface IController {
	getById(req: Request, res: Response, next: NextFunction): void;
	getAll(req: Request, res: Response, next: NextFunction): void;
	create(req: Request, res: Response, next: NextFunction): void;
	update(req: Request, res: Response, next: NextFunction): void;
	remove(req: Request, res: Response, next: NextFunction): void;
	addLine(req: Request, res: Response, next: NextFunction): void;
	updateLine(req: Request, res: Response, next: NextFunction): void;
	removeLine(req: Request, res: Response, next: NextFunction): void;
	createVersion(req: Request, res: Response, next: NextFunction): void;
	getVersions(req: Request, res: Response, next: NextFunction): void;
	getVersionById(req: Request, res: Response, next: NextFunction): void;
	updateVersion(req: Request, res: Response, next: NextFunction): void;
	removeVersion(req: Request, res: Response, next: NextFunction): void;
	createProjectConversion(req: Request, res: Response, next: NextFunction): void;
	getProjectConversions(req: Request, res: Response, next: NextFunction): void;
}

export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/demand-plan";

	routes.get(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		cache({
			ttl: 60,
			keyGenerator: (req: Request) => {
				const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
				return `cache:demandPlan:list:${queryKey}`;
			},
		}),
		controller.getAll,
	);

	routes.post(
		"/",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		transformFormData,
		validate(CreateDemandPlanSchema),
		controller.create,
	);

	routes.get(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("id"),
		controller.getById,
	);

	routes.patch(
		"/:id",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		transformFormData,
		validate(UpdateDemandPlanSchema),
		controller.update,
	);

	routes.delete("/:id", validateWorkspaceId, requireWorkspaceRole(DELETE_ROLES), validateObjectId("id"), controller.remove);

	routes.post(
		"/:id/lines",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		transformFormData,
		validate(CreateDemandLineSchema),
		controller.addLine,
	);

	routes.patch(
		"/:id/lines/:lineId",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		validateObjectId("lineId"),
		transformFormData,
		validate(UpdateDemandLineSchema),
		controller.updateLine,
	);

	routes.delete(
		"/:id/lines/:lineId",
		validateWorkspaceId,
		requireWorkspaceRole(DELETE_ROLES),
		validateObjectId("id"),
		validateObjectId("lineId"),
		controller.removeLine,
	);

	routes.get(
		"/:id/versions",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("id"),
		controller.getVersions,
	);

	routes.post(
		"/:id/versions",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		transformFormData,
		validate(CreateDemandEstimateVersionSchema),
		controller.createVersion,
	);

	routes.get(
		"/:id/versions/:versionId",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("id"),
		validateObjectId("versionId"),
		controller.getVersionById,
	);

	routes.patch(
		"/:id/versions/:versionId",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		validateObjectId("versionId"),
		transformFormData,
		validate(UpdateDemandEstimateVersionSchema),
		controller.updateVersion,
	);

	routes.delete(
		"/:id/versions/:versionId",
		validateWorkspaceId,
		requireWorkspaceRole(DELETE_ROLES),
		validateObjectId("id"),
		validateObjectId("versionId"),
		controller.removeVersion,
	);

	routes.get(
		"/:id/project-conversions",
		validateWorkspaceId,
		requireWorkspaceRole(READ_ROLES),
		validateObjectId("id"),
		controller.getProjectConversions,
	);

	routes.post(
		"/:id/project-conversions",
		validateWorkspaceId,
		requireWorkspaceRole(WRITE_ROLES),
		validateObjectId("id"),
		transformFormData,
		validate(CreateProjectConversionSchema),
		controller.createProjectConversion,
	);

	route.use(path, routes);
	return route;
};
