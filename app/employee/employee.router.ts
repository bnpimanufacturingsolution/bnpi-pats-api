import { Router, Request, Response, NextFunction } from "express";
import { cache } from "../../middleware/cache";
import { validateObjectId } from "../../middleware/validate";
import { EmployeeController } from "./employee.controller";
import { validateWorkspaceId } from "../../middleware/validateWorkspaceId";
import { requireWorkspaceRole } from "../../middleware/workspaceAuth";

const READ_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
const WRITE_ROLES = ["OWNER", "ADMIN", "MEMBER"];
const DELETE_ROLES = ["OWNER", "ADMIN"];

/**
 * @openapi
 * tags:
 *   - name: Employee
 *     description: Employee management (database-backed)
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
 *       Retrieves employees from the database.
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
    requireWorkspaceRole(READ_ROLES),
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
  routes.get("/stats", validateWorkspaceId, requireWorkspaceRole(READ_ROLES), controller.getStats);

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
  routes.get(
    "/external/:externalId",
    validateWorkspaceId,
    requireWorkspaceRole(READ_ROLES),
    controller.getByExternalId
  );

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
    requireWorkspaceRole(READ_ROLES),
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
  routes.post("/", validateWorkspaceId, requireWorkspaceRole(WRITE_ROLES), controller.create);

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
  routes.put(
    "/:id",
    validateWorkspaceId,
    requireWorkspaceRole(WRITE_ROLES),
    validateObjectId("id"),
    controller.update
  );

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
  routes.delete(
    "/:id",
    validateWorkspaceId,
    requireWorkspaceRole(DELETE_ROLES),
    validateObjectId("id"),
    controller.remove
  );

  route.use(path, routes);

  return route;
};

export default router;
