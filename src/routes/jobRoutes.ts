
import { Router } from "express";
import { getJobs } from "../controllers/jobController";

const router = Router();

/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: Get tenant jobs with cursor pagination
 *     tags:
 *       - Jobs
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         example: tenant-a
 *       - in: query
 *         name: sourceId
 *         required: true
 *         schema:
 *           type: string
 *         example: main
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [active, archived, all]
 *           default: active
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId from the previous page
 *     responses:
 *       200:
 *         description: Paginated jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *                 hasMore:
 *                   type: boolean
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */
router.get("/", getJobs);

export default router;
