
import { Router } from "express";
import { createEvent,getEventById } from "../controllers/eventController";

const router = Router();

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Accept a new job event
 *     tags:
 *       - Events
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *               - sourceId
 *               - eventId
 *               - externalJobId
 *               - version
 *               - operation
 *             properties:
 *               tenantId:
 *                 type: string
 *                 example: tenant-a
 *               sourceId:
 *                 type: string
 *                 example: main
 *               eventId:
 *                 type: string
 *                 example: event-101
 *               externalJobId:
 *                 type: string
 *                 example: alpha
 *               version:
 *                 type: integer
 *                 example: 1
 *               operation:
 *                 type: string
 *                 enum: [upsert, archive]
 *               payload:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                     example: Full Stack Developer
 *                   company:
 *                     type: string
 *                     example: Example Labs
 *                   location:
 *                     type: string
 *                     example: Surat
 *                   experienceMin:
 *                     type: integer
 *                     example: 1
 *                   experienceMax:
 *                     type: integer
 *                     example: 3
 *                   applyUrl:
 *                     type: string
 *                     example: https://example.test/jobs/alpha
 *                   skills:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: [TypeScript, MongoDB]
 *     responses:
 *       202:
 *         description: New event accepted
 *       200:
 *         description: Exact replay of an existing event
 *       400:
 *         description: Invalid event
 *       409:
 *         description: Conflicting event identity
 *       500:
 *         description: Internal server error
 */
router.post("/", createEvent);


/**
 * @swagger
 * /events/{eventId}:
 *   get:
 *     summary: Get event processing status
 *     tags:
 *       - Events
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         example: event-101
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
 *     responses:
 *       200:
 *         description: Event processing details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eventId:
 *                   type: string
 *                 tenantId:
 *                   type: string
 *                 sourceId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [pending, processing, completed, failed]
 *                 attempts:
 *                   type: integer
 *                 lastError:
 *                   type: string
 *                   nullable: true
 *                 attemptHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal server error
 */
router.get("/:eventId", getEventById);


export default router;
