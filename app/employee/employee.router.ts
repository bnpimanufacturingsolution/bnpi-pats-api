import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validateObjectId } from "../../middleware/validate";
import { EmployeeController } from "./employee.controller";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";

/**
 * @openapi
 * tags:
 *   - name: Employee
 *     description: Employee management with third-party API sync and database fallback
 */

export const router = (route: Router, controller: EmployeeController): Router => {
  const routes = Router();
  const path = "/employee";

  /**
   * @openapi
   * /api/employee:
   *   get:
   *     tags: [Employee]
   *     summary: Get all employees
   *     description: |
   *       Retrieves employees. If syncConfig is provided, attempts to sync from
   *       third-party API first, falling back to database on failure.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Items per page
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [ACTIVE, INACTIVE, ON_LEAVE, TERMINATED, SUSPENDED]
   *         description: Filter by status
   *       - in: query
   *         name: department
   *         schema:
   *           type: string
   *         description: Filter by department
   *       - in: query
   *         name: forceDatabase
   *         schema:
   *           type: boolean
   *         description: Skip API sync and use database only
   *     responses:
   *       200:
   *         description: List of employees
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  routes.get(
    "/",
    validateWorkspaceId,
    cache({
      ttl: 60,
      keyGenerator: (req: Request) => {
        const queryKey = Buffer.from(JSON.stringify(req.query || {})).toString("base64");
        return `cache:employee:list:${queryKey}`;
      },
    }),
    controller.getAll
  );

  /**
   * @openapi
   * /api/employee/stats:
   *   get:
   *     tags: [Employee]
   *     summary: Get employee statistics
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Employee statistics by status, department, and sync status
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  routes.get("/stats", validateWorkspaceId, controller.getStats);

  /**
   * @openapi
   * /api/employee/sync:
   *   post:
   *     tags: [Employee]
   *     summary: Trigger employee sync from external API
   *     description: |
   *       Syncs employees from a third-party API. Falls back to database if API fails.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - apiUrl
   *             properties:
   *               apiUrl:
   *                 type: string
   *                 description: Third-party API URL
   *                 example: "https://api.hris-system.com/employees"
   *               authType:
   *                 type: string
   *                 enum: [bearer, api-key, basic, none]
   *                 default: bearer
   *               authToken:
   *                 type: string
   *                 description: Authentication token
   *               apiKey:
   *                 type: string
   *                 description: API key (for api-key auth)
   *               headers:
   *                 type: object
   *                 description: Additional headers
   *               timeout:
   *                 type: integer
   *                 default: 30000
   *               retryAttempts:
   *                 type: integer
   *                 default: 3
   *               fieldMapping:
   *                 type: object
   *                 description: Custom field mapping from external to internal names
   *     responses:
   *       200:
   *         description: Sync result with statistics
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  routes.post("/sync", validateWorkspaceId, controller.sync);

  /**
   * @openapi
   * /api/employee/sync/status:
   *   get:
   *     tags: [Employee]
   *     summary: Get sync status and health
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Sync status including any issues
   */
  routes.get("/sync/status", validateWorkspaceId, controller.getSyncStatus);

  /**
   * @openapi
   * /api/employee/sync/issues:
   *   get:
   *     tags: [Employee]
   *     summary: Get employees with sync issues
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of employees with FAILED or PENDING sync status
   */
  routes.get("/sync/issues", validateWorkspaceId, controller.getSyncIssues);

  /**
   * @openapi
   * /api/employee/external/{externalId}:
   *   get:
   *     tags: [Employee]
   *     summary: Get employee by external ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: externalId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: externalSource
   *         schema:
   *           type: string
   *         description: Filter by external source
   *     responses:
   *       200:
   *         description: Employee details
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  routes.get("/external/:externalId", validateWorkspaceId, controller.getByExternalId);

  /**
   * @openapi
   * /api/employee/{id}:
   *   get:
   *     tags: [Employee]
   *     summary: Get employee by ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           pattern: '^[0-9a-fA-F]{24}$'
   *         description: Employee ID (MongoDB ObjectId)
   *     responses:
   *       200:
   *         description: Employee details
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  routes.get(
    "/:id",
    validateWorkspaceId,
    validateObjectId("id"),
    cache({
      ttl: 90,
      keyGenerator: (req: Request) => `cache:employee:byId:${req.params.id}`,
    }),
    controller.getById
  );

  /**
   * @openapi
   * /api/employee:
   *   post:
   *     tags: [Employee]
   *     summary: Create a new employee manually
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - employeeNumber
   *               - firstName
   *               - lastName
   *               - email
   *             properties:
   *               employeeNumber:
   *                 type: string
   *                 example: "EMP-001"
   *               firstName:
   *                 type: string
   *                 example: "John"
   *               middleName:
   *                 type: string
   *               lastName:
   *                 type: string
   *                 example: "Doe"
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "john.doe@company.com"
   *               phone:
   *                 type: string
   *               department:
   *                 type: string
   *               position:
   *                 type: string
   *               status:
   *                 type: string
   *                 enum: [ACTIVE, INACTIVE, ON_LEAVE, TERMINATED, SUSPENDED]
   *                 default: ACTIVE
   *     responses:
   *       201:
   *         description: Employee created
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       409:
   *         description: Duplicate email or employee number
   */
  routes.post("/", validateWorkspaceId, controller.create);

  /**
   * @openapi
   * /api/employee/{id}:
   *   put:
   *     tags: [Employee]
   *     summary: Update employee
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Employee updated
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  routes.put("/:id", validateWorkspaceId, validateObjectId("id"), controller.update);

  /**
   * @openapi
   * /api/employee/{id}:
   *   delete:
   *     tags: [Employee]
   *     summary: Delete employee (soft delete)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Employee deleted
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  routes.delete("/:id", validateWorkspaceId, validateObjectId("id"), controller.remove);

  route.use(path, routes);

  return route;
};

export default router;
