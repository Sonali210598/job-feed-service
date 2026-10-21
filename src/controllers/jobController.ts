
import { Request, Response } from "express";
import mongoose from "mongoose";
import Job from "../models/Job";

export const getJobs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      tenantId,
      sourceId,
      status = "active",
      limit = "20",
      cursor
    } = req.query;

    // Validate identifiers
    const validId = (value: unknown): value is string => {
      return (
        typeof value === "string" &&
        value.trim() !== "" &&
        value === value.trim()
      );
    };

    if (!validId(tenantId) || !validId(sourceId)) {
      res.status(400).json({
        message: "Valid tenantId and sourceId are required"
      });
      return;
    }

    // Validate status
    if (
      status !== "active" &&
      status !== "archived" &&
      status !== "all"
    ) {
      res.status(400).json({
        message: "Status must be active, archived or all"
      });
      return;
    }

    // Validate limit
    if (
      typeof limit !== "string" ||
      !/^[1-9]\d*$/.test(limit) ||
      !Number.isSafeInteger(Number(limit)) ||
      Number(limit) > 100
    ) {
      res.status(400).json({
        message: "Limit must be between 1 and 100"
      });
      return;
    }

    const pageLimit = Number(limit);

    // Build tenant-scoped filter
    const filter: Record<string, unknown> = {
      tenantId,
      sourceId
    };

    if (status !== "all") {
      filter.status = status;
    }

    // Validate and apply cursor
    if (cursor !== undefined) {
      if (
        typeof cursor !== "string" ||
        !/^[a-fA-F0-9]{24}$/.test(cursor)
      ) {
        res.status(400).json({
          message: "Invalid cursor"
        });
        return;
      }

      filter._id = {
        $gt: new mongoose.Types.ObjectId(cursor)
      };
    }

    // Fetch one extra job to check for another page
    const jobs = await Job.find(filter)
      .sort({ _id: 1 })
      .limit(pageLimit + 1)
      .lean();

    const hasMore = jobs.length > pageLimit;

    const results = hasMore
      ? jobs.slice(0, pageLimit)
      : jobs;

    const nextCursor =
      hasMore && results.length > 0
        ? String(results[results.length - 1]._id)
        : null;

    res.status(200).json({
      jobs: results,
      nextCursor,
      hasMore
    });

  } catch (error) {
    console.error("Get jobs error:", error);

    res.status(500).json({
      message: "Internal server error"
    });
  }
};
