
import { Request, Response } from "express";
import Event from "../models/Event";
import { validateEvent } from "../utils/validateEvent";
import { compareJson } from "../utils/compareJson";

export const createEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Step 1: Validate request
    const result = validateEvent(req.body);

    if (!result.valid) {
      res.status(400).json({
        message: result.error
      });
      return;
    }

    const eventData = result.data;

    // Step 2: Event identity
    const filter = {
      tenantId: eventData.tenantId,
      sourceId: eventData.sourceId,
      eventId: eventData.eventId
    };

    // Step 3: Check existing event
    const existingEvent = await Event.findOne(filter);

    if (existingEvent) {
      const isSame = compareJson(
        existingEvent.rawEvent,
        req.body
      );

      if (isSame) {
        res.status(200).json({
          message: "Event already accepted",
          eventId: existingEvent.eventId,
          status: existingEvent.status
        });
        return;
      }

      res.status(409).json({
        message: "Event ID already exists with different content"
      });
      return;
    }

    // Step 4: Save new event
    const newEvent = await Event.create({
      ...eventData,
      rawEvent: req.body,
      status: "pending",
      attempts: 0,
      attemptHistory: [],
      nextAttemptAt: new Date()
    });

    res.status(202).json({
      message: "Event accepted",
      eventId: newEvent.eventId,
      status: newEvent.status
    });

  } catch (error: unknown) {
    // Concurrent requests may race to insert the same event
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      try {
        const result = validateEvent(req.body);

        if (!result.valid) {
          res.status(400).json({ message: result.error });
          return;
        }

        const existingEvent = await Event.findOne({
          tenantId: result.data.tenantId,
          sourceId: result.data.sourceId,
          eventId: result.data.eventId
        });

        if (existingEvent) {
          const isSame = compareJson(
            existingEvent.rawEvent,
            req.body
          );

          res.status(isSame ? 200 : 409).json({
            message: isSame
              ? "Event already accepted"
              : "Event ID already exists with different content",
            eventId: existingEvent.eventId,
            status: existingEvent.status
          });
          return;
        }
      } catch (lookupError) {
        console.error("Replay lookup failed:", lookupError);
      }
    }

    console.error("Create event error:", error);

    res.status(500).json({
      message: "Internal server error"
    });
  }
};



export const getEventById = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Step 1: Read URL parameters
      const { eventId } = req.params;
      const { tenantId, sourceId } = req.query;
  
      // Step 2: Validate identifiers
      const isValidId = (value: unknown): value is string => {
        return (
          typeof value === "string" &&
          value.trim() !== "" &&
          value === value.trim()
        );
      };
  
      if (
        !isValidId(eventId) ||
        !isValidId(tenantId) ||
        !isValidId(sourceId)
      ) {
        res.status(400).json({
          message: "Valid eventId, tenantId and sourceId are required"
        });
        return;
      }
  
      // Step 3: Find event in MongoDB
      const event = await Event.findOne({
        eventId,
        tenantId,
        sourceId
      }).lean();
  
      // Step 4: Handle missing event
      if (!event) {
        res.status(404).json({
          message: "Event not found"
        });
        return;
      }
  
      // Step 5: Return event processing information
      res.status(200).json({
        eventId: event.eventId,
        tenantId: event.tenantId,
        sourceId: event.sourceId,
        externalJobId: event.externalJobId,
        version: event.version,
        operation: event.operation,
        status: event.status,
        attempts: event.attempts,
        lastError: event.lastError ?? null,
        attemptHistory: event.attemptHistory ?? [],
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
      });
  
    } catch (error) {
      console.error("Get event error:", error);
  
      res.status(500).json({
        message: "Internal server error"
      });
    }
  };
  