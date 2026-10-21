
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";

import connectDB from "./config/db";
import swaggerSpec from "./config/swagger";
import eventRoutes from "./routes/eventRoutes";
import jobRoutes from "./routes/jobRoutes";
import Job from "./models/Job";
import { startWorkers } from "./workers/startWorker";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 5000;

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use("/events", eventRoutes);
app.use("/jobs", jobRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Job Feed Service is running"
  });
});

app.get("/health", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;

  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? "healthy" : "unhealthy",
    database: isConnected ? "connected" : "disconnected"
  });
});

const startServer = async () => {
  await connectDB();

  // Ensure unique indexes exist before accepting requests
  const Event = (await import("./models/Event")).default;
  await Event.init();
  await Job.init();
  startWorkers();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger: http://localhost:${PORT}/api-docs`);
  });
};

startServer();
