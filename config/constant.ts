// ─── Factory Helpers ─────────────────────────────────────────────────────────
// Generate standard CRUD success messages for any entity.
// Override or extend by spreading: { ...buildSuccessMessages("Item", "Items"), CUSTOM: "..." }

const buildSuccessMessages = (singular: string, plural: string) => ({
	CREATED: `${singular} created successfully`,
	UPDATED: `${singular} updated successfully`,
	DELETED: `${singular} deleted successfully`,
	RETRIEVED: `${singular} retrieved successfully`,
	RETRIEVED_ALL: `${plural} retrieved successfully`,
});

// ─── Config ──────────────────────────────────────────────────────────────────

export const config = {
	ERROR: {
		QUERY_PARAMS: {
			MISSING_ID: "ID parameter is required",
			INVALID_POPULATE: "Invalid populate parameter",
			POPULATE_MUST_BE_STRING: "Populate must be a string",
			INVALID_PAGE: "Invalid page",
			INVALID_LIMIT: "Invalid limit",
			INVALID_ORDER: "Invalid order",
			ORDER_MUST_BE_ASC_OR_DESC: "Order must be asc or desc",
			INVALID_SORT: "Invalid sort",
			SORT_MUST_BE_STRING: "Sort must be a string",
			INVALID_FILTER: "Invalid filter",
			FILTER_MUST_BE_STRING: "Filter must be a string",
			INVALID_QUERY: "Invalid query",
			QUERY_MUST_BE_STRING: "Query must be a string",
			INVALID_DOCUMENT: "Invalid document",
			DOCUMENT_MUST_BE_STRING: "Document must be a string",
			INVALID_PAGINATION: "Invalid pagination",
			PAGINATION_MUST_BE_STRING: "Pagination must be a string",
			INVALID_COUNT: "Invalid count",
			COUNT_MUST_BE_STRING: "Count must be a string",
			INVALID_GROUPBY: "Invalid groupBy",
			INVALID_COMBINATION: "Invalid combination",
		},
		COMMON: {
			INTERNAL_SERVER_ERROR: "Internal server error",
			VALIDATION_ERROR: "Validation error",
			NOT_FOUND: "Resource not found",
			UNAUTHORIZED: "Unauthorized access",
			NO_UPDATE_FIELDS: "No fields provided for update",
			DATA_NOT_FOUND: "Data not found",
		},
		WORKSPACE_MEMBER: {
			VALIDATION_FAILED: "Workspace member validation failed",
			NOT_FOUND: "Workspace member not found",
			ALREADY_EXISTS: "User is already a member of this workspace",
			CANNOT_REMOVE_LAST_OWNER: "Cannot remove or demote the last workspace owner",
			INSUFFICIENT_ROLE: "Insufficient workspace role for this action",
		},
		PROJECT_MEMBER: {
			VALIDATION_FAILED: "Project member validation failed",
			NOT_FOUND: "Project member not found",
			ALREADY_EXISTS: "User is already a member of this project",
			NOT_WORKSPACE_MEMBER: "User must be a workspace member before being added to a project",
			INSUFFICIENT_ROLE: "Insufficient project role for this action",
		},
	},

	SUCCESS: {
		// Standard CRUD entities (generated)
		TEMPLATE: buildSuccessMessages("Template", "Templates"),
		CATEGORY: { ...buildSuccessMessages("Category", "Categories"), CODE_GENERATED: "Category code generated successfully" },
		EMPLOYEE: {
			...buildSuccessMessages("Employee", "Employees"),
			SYNC_STATUS: "Sync status retrieved successfully",
			SYNC_ISSUES: "Sync issues retrieved successfully",
			STATISTICS: "Employee statistics retrieved successfully",
		},
		FIELD: buildSuccessMessages("Field", "Fields"),
		ESTIMATION: { ...buildSuccessMessages("Estimation", "Estimations"), DRAFT_CREATED: "Draft estimation created successfully" },
		SEQUENTIAL: buildSuccessMessages("Sequential", "Sequentials"),
		MILESTONE: buildSuccessMessages("Milestone", "Milestones"),
		TRANSACTION: {
			...buildSuccessMessages("Transaction", "Transactions"),
			METRICS: "Transaction metrics retrieved successfully",
			CLEARED: "Transaction marked as cleared",
		},
		USAGE_CODE: buildSuccessMessages("Usage code", "Usage codes"),
		ITEM_TYPE: buildSuccessMessages("Item type", "Item types"),
		PRODUCT: buildSuccessMessages("Product", "Products"),
		DEMAND_PLAN: {
			...buildSuccessMessages("Demand plan", "Demand plans"),
			VERSION_CREATED: "Demand estimate version created successfully",
			VERSION_UPDATED: "Demand estimate version updated successfully",
			VERSION_DELETED: "Demand estimate version deleted successfully",
			LINE_CREATED: "Demand line created successfully",
			LINE_UPDATED: "Demand line updated successfully",
			LINE_DELETED: "Demand line deleted successfully",
			PROJECT_CONVERSION_CREATED: "Project conversion created successfully",
		},
		PROJECT: { ...buildSuccessMessages("Project", "Projects"), CODE_GENERATED: "Project code generated successfully" },
		ITEM: { ...buildSuccessMessages("Item", "Items"), UPDATED_WITH_DOCS: "Item updated with documents successfully" },
		ORDER: buildSuccessMessages("Order", "Orders"),
		VENDOR: buildSuccessMessages("Vendor", "Vendors"),
		PAYSLIP: buildSuccessMessages("Payslip", "Payslips"),
		WORKSPACE: buildSuccessMessages("Workspace", "Workspaces"),
		PURCHASE_ORDER: buildSuccessMessages("Purchase order", "Purchase orders"),
		DELIVERY_ORDER: buildSuccessMessages("Delivery order", "Delivery orders"),
		INVOICE: buildSuccessMessages("Invoice", "Invoices"),
		PAYMENT_TERM: buildSuccessMessages("Payment term", "Payment terms"),
		PAYMENT_SCHEDULE: { ...buildSuccessMessages("Payment schedule", "Payment schedules"), PAYMENT_RELEASED: "Payment released successfully" },
		WORKSPACE_MEMBER: {
			ADDED: "Workspace member added successfully",
			UPDATED: "Workspace member role updated successfully",
			REMOVED: "Workspace member removed successfully",
			RETRIEVED: "Workspace member retrieved successfully",
			RETRIEVED_ALL: "Workspace members retrieved successfully",
		},
		PROJECT_MEMBER: {
			ADDED: "Project member added successfully",
			UPDATED: "Project member role updated successfully",
			REMOVED: "Project member removed successfully",
			RETRIEVED: "Project member retrieved successfully",
			RETRIEVED_ALL: "Project members retrieved successfully",
		},
		PO_TYPE: buildSuccessMessages("PO type", "PO types"),
	},

	AUDIT_LOG: {
		ACTIONS: {
			CREATE: "CREATE",
			READ: "READ",
			UPDATE: "UPDATE",
			DELETE: "DELETE",
			LOGIN: "LOGIN",
			LOGOUT: "LOGOUT",
			REGISTER: "REGISTER",
		},
	},
};
