import {
	PrismaClient,
	Prisma,
	DemandPlan,
	DemandLine,
	DemandEstimateVersion,
	DemandEstimateLine,
	DemandMaterialRequirement,
	DemandLaborRequirement,
	ProjectConversion,
	Product,
} from "../../generated/prisma";
import {
	CreateDemandPlan,
	UpdateDemandPlan,
	CreateDemandLine,
	UpdateDemandLine,
	CreateDemandEstimateVersion,
	UpdateDemandEstimateVersion,
	CreateDemandEstimateLine,
	CreateDemandMaterialRequirement,
	CreateDemandLaborRequirement,
	CreateProjectConversion,
} from "../../zod/demand.zod";

type DemandPlanCreateInput = CreateDemandPlan & {
	workspaceId: string;
	organizationId?: string;
	planCode: string;
};

type DemandLineCreateInput = CreateDemandLine & {
	workspaceId: string;
	organizationId?: string;
	demandPlanId: string;
	lineNo: number;
	productCode: string;
	productName: string;
	unitOfMeasure: string;
};

type DemandEstimateVersionCreateInput = CreateDemandEstimateVersion & {
	workspaceId: string;
	organizationId?: string;
	demandPlanId: string;
	versionNumber: number;
};

type DemandEstimateLineCreateInput = CreateDemandEstimateLine & {
	workspaceId: string;
	organizationId?: string;
	demandPlanId: string;
	demandEstimateVersionId: string;
	lineNo: number;
	productCode: string;
	productName: string;
	unitOfMeasure: string;
};

type DemandMaterialRequirementCreateInput = CreateDemandMaterialRequirement & {
	workspaceId: string;
	organizationId?: string;
	demandPlanId: string;
	demandEstimateVersionId: string;
	lineNo: number;
};

type DemandLaborRequirementCreateInput = CreateDemandLaborRequirement & {
	workspaceId: string;
	organizationId?: string;
	demandPlanId: string;
	demandEstimateVersionId: string;
	lineNo: number;
};

type ProjectConversionCreateInput = CreateProjectConversion & {
	workspaceId: string;
	organizationId?: string;
	demandPlanId: string;
	demandEstimateVersionId: string;
};

export const demandRepository = (prisma: PrismaClient | Prisma.TransactionClient) => {
	const createPlan = async (data: DemandPlanCreateInput): Promise<DemandPlan> => {
		return await prisma.demandPlan.create({
			data: data as Prisma.DemandPlanUncheckedCreateInput,
		});
	};

	const findMany = async (
		findManyQuery: Prisma.DemandPlanFindManyArgs,
		whereClause: Prisma.DemandPlanWhereInput,
		options: { document: boolean; count: boolean },
	): Promise<[DemandPlan[], number]> => {
		return await Promise.all([
			options.document ? prisma.demandPlan.findMany(findManyQuery) : [],
			options.count ? prisma.demandPlan.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.DemandPlanFindFirstArgs): Promise<DemandPlan | null> => {
		return await prisma.demandPlan.findFirst(query);
	};

	const findProductById = async (productId: string, workspaceId: string): Promise<Product | null> => {
		return await prisma.product.findFirst({
			where: { id: productId, workspaceId, isDeleted: false },
		});
	};

	const findLinesByPlanId = async (
		demandPlanId: string,
		workspaceId: string,
	): Promise<DemandLine[]> => {
		return await prisma.demandLine.findMany({
			where: { demandPlanId, workspaceId, isDeleted: false },
			orderBy: { lineNo: "asc" },
		});
	};

	const getLineById = async (
		id: string,
		workspaceId: string,
	): Promise<DemandLine | null> => {
		return await prisma.demandLine.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});
	};

	const createLine = async (data: DemandLineCreateInput): Promise<DemandLine> => {
		return await prisma.demandLine.create({
			data: data as Prisma.DemandLineUncheckedCreateInput,
		});
	};

	const updateLine = async (
		id: string,
		data: UpdateDemandLine,
		workspaceId: string,
	): Promise<{ existingLine: DemandLine | null; updatedLine: DemandLine | null }> => {
		const existingLine = await prisma.demandLine.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existingLine) {
			return { existingLine: null, updatedLine: null };
		}

		const updatedLine = await prisma.demandLine.update({
			where: { id },
			data: data as Prisma.DemandLineUpdateInput,
		});

		return { existingLine, updatedLine };
	};

	const removeLine = async (id: string, workspaceId: string): Promise<DemandLine | null> => {
		const existingLine = await prisma.demandLine.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existingLine) {
			return null;
		}

		await prisma.demandEstimateLine.updateMany({
			where: {
				demandLineId: id,
				isDeleted: false,
			},
			data: { isDeleted: true },
		});

		await prisma.demandLine.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingLine;
	};

	const createEstimateVersion = async (
		data: DemandEstimateVersionCreateInput,
	): Promise<DemandEstimateVersion> => {
		return await prisma.demandEstimateVersion.create({
			data: data as Prisma.DemandEstimateVersionUncheckedCreateInput,
		});
	};

	const findVersionsByPlanId = async (
		demandPlanId: string,
		workspaceId: string,
	): Promise<DemandEstimateVersion[]> => {
		return await prisma.demandEstimateVersion.findMany({
			where: { demandPlanId, workspaceId, isDeleted: false },
			orderBy: { versionNumber: "asc" },
		});
	};

	const getVersionById = async (
		id: string,
		workspaceId: string,
	): Promise<DemandEstimateVersion | null> => {
		return await prisma.demandEstimateVersion.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});
	};

	const updateEstimateVersion = async (
		id: string,
		data: UpdateDemandEstimateVersion,
		workspaceId: string,
	): Promise<{ existingVersion: DemandEstimateVersion | null; updatedVersion: DemandEstimateVersion | null }> => {
		const existingVersion = await prisma.demandEstimateVersion.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existingVersion) {
			return { existingVersion: null, updatedVersion: null };
		}

		const updatedVersion = await prisma.demandEstimateVersion.update({
			where: { id },
			data: data as Prisma.DemandEstimateVersionUpdateInput,
		});

		return { existingVersion, updatedVersion };
	};

	const removeEstimateVersion = async (
		id: string,
		workspaceId: string,
	): Promise<DemandEstimateVersion | null> => {
		const existingVersion = await prisma.demandEstimateVersion.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existingVersion) {
			return null;
		}

		await prisma.demandEstimateLine.updateMany({
			where: {
				demandEstimateVersionId: id,
				isDeleted: false,
			},
			data: { isDeleted: true },
		});

		await prisma.demandMaterialRequirement.updateMany({
			where: {
				demandEstimateVersionId: id,
				isDeleted: false,
			},
			data: { isDeleted: true },
		});

		await prisma.demandLaborRequirement.updateMany({
			where: {
				demandEstimateVersionId: id,
				isDeleted: false,
			},
			data: { isDeleted: true },
		});

		await prisma.projectConversion.updateMany({
			where: {
				demandEstimateVersionId: id,
				isDeleted: false,
			},
			data: { isDeleted: true },
		});

		await prisma.demandEstimateVersion.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingVersion;
	};

	const createEstimateLine = async (data: DemandEstimateLineCreateInput): Promise<DemandEstimateLine> => {
		return await prisma.demandEstimateLine.create({
			data: data as Prisma.DemandEstimateLineUncheckedCreateInput,
		});
	};

	const findEstimateLinesByVersionId = async (
		demandEstimateVersionId: string,
		workspaceId: string,
	): Promise<DemandEstimateLine[]> => {
		return await prisma.demandEstimateLine.findMany({
			where: { demandEstimateVersionId, workspaceId, isDeleted: false },
			orderBy: { lineNo: "asc" },
		});
	};

	const createMaterialRequirement = async (
		data: DemandMaterialRequirementCreateInput,
	): Promise<DemandMaterialRequirement> => {
		return await prisma.demandMaterialRequirement.create({
			data: data as Prisma.DemandMaterialRequirementUncheckedCreateInput,
		});
	};

	const createLaborRequirement = async (
		data: DemandLaborRequirementCreateInput,
	): Promise<DemandLaborRequirement> => {
		return await prisma.demandLaborRequirement.create({
			data: data as Prisma.DemandLaborRequirementUncheckedCreateInput,
		});
	};

	const createProjectConversion = async (
		data: ProjectConversionCreateInput,
	): Promise<ProjectConversion> => {
		const existingConversion = await prisma.projectConversion.findFirst({
			where: {
				demandEstimateVersionId: data.demandEstimateVersionId,
				isDeleted: false,
			},
		});

		if (existingConversion) {
			return await prisma.projectConversion.update({
				where: { id: existingConversion.id },
				data: {
					...data,
					metadata: data.metadata ?? existingConversion.metadata,
				} as Prisma.ProjectConversionUpdateInput,
			});
		}

		return await prisma.projectConversion.create({
			data: data as Prisma.ProjectConversionUncheckedCreateInput,
		});
	};

	const findProjectConversionsByPlanId = async (
		demandPlanId: string,
		workspaceId: string,
	): Promise<ProjectConversion[]> => {
		return await prisma.projectConversion.findMany({
			where: { demandPlanId, workspaceId, isDeleted: false },
			orderBy: { createdAt: "desc" },
		});
	};

	const getProjectConversionById = async (
		id: string,
		workspaceId: string,
	): Promise<ProjectConversion | null> => {
		return await prisma.projectConversion.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});
	};

	const updatePlan = async (
		id: string,
		data: UpdateDemandPlan,
		workspaceId: string,
	): Promise<{ existingPlan: DemandPlan | null; updatedPlan: DemandPlan | null }> => {
		const existingPlan = await prisma.demandPlan.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existingPlan) {
			return { existingPlan: null, updatedPlan: null };
		}

		const updatedPlan = await prisma.demandPlan.update({
			where: { id },
			data: data as Prisma.DemandPlanUpdateInput,
		});

		return { existingPlan, updatedPlan };
	};

	const removePlan = async (id: string, workspaceId: string): Promise<DemandPlan | null> => {
		const existingPlan = await prisma.demandPlan.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existingPlan) {
			return null;
		}

		const versions = await prisma.demandEstimateVersion.findMany({
			where: { demandPlanId: id, isDeleted: false },
			select: { id: true },
		});

		const versionIds = versions.map((version) => version.id);

		if (versionIds.length > 0) {
			await Promise.all([
				prisma.demandEstimateLine.updateMany({
					where: { demandEstimateVersionId: { in: versionIds }, isDeleted: false },
					data: { isDeleted: true },
				}),
				prisma.demandMaterialRequirement.updateMany({
					where: { demandEstimateVersionId: { in: versionIds }, isDeleted: false },
					data: { isDeleted: true },
				}),
				prisma.demandLaborRequirement.updateMany({
					where: { demandEstimateVersionId: { in: versionIds }, isDeleted: false },
					data: { isDeleted: true },
				}),
				prisma.projectConversion.updateMany({
					where: { demandEstimateVersionId: { in: versionIds }, isDeleted: false },
					data: { isDeleted: true },
				}),
			]);
		}

		await Promise.all([
			prisma.demandLine.updateMany({
				where: { demandPlanId: id, isDeleted: false },
				data: { isDeleted: true },
			}),
			prisma.demandEstimateVersion.updateMany({
				where: { demandPlanId: id, isDeleted: false },
				data: { isDeleted: true },
			}),
			prisma.projectConversion.updateMany({
				where: { demandPlanId: id, isDeleted: false },
				data: { isDeleted: true },
			}),
		]);

		await prisma.demandPlan.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingPlan;
	};

	const count = async (params?: { where?: Prisma.DemandPlanWhereInput }): Promise<number> => {
		return await prisma.demandPlan.count({
			where: {
				...params?.where,
				isDeleted: false,
			},
		});
	};

	return {
		createPlan,
		findMany,
		getById,
		findProductById,
		findLinesByPlanId,
		getLineById,
		createLine,
		updateLine,
		removeLine,
		createEstimateVersion,
		findVersionsByPlanId,
		getVersionById,
		updateEstimateVersion,
		removeEstimateVersion,
		createEstimateLine,
		findEstimateLinesByVersionId,
		createMaterialRequirement,
		createLaborRequirement,
		createProjectConversion,
		findProjectConversionsByPlanId,
		getProjectConversionById,
		updatePlan,
		removePlan,
		count,
	};
};
