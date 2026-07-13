import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

import authRoutes from "./routes/auth.routes.js";
import masterRoutes from "./routes/master.routes.js";
import gdmRoutes from "./routes/gdm.routes.js";
import gcRoutes from "./routes/gc.routes.js";
import messageRoutes from "./routes/message.routes.js";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Prisma Client
export const prisma = new PrismaClient();

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:3000", "http://localhost:5173"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/v1/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/v1/auth", authRoutes);
app.use("/v1/master", masterRoutes);
app.use("/v1/gdm", gdmRoutes);
app.use("/v1/gc", gcRoutes);
app.use("/v1/messages", messageRoutes);

// 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: err.message || "An unexpected error occurred",
  });
});

// Start Server
const start = async () => {
  try {
    await prisma.$connect();
    console.log("✓ SQLite Database Connected");
    app.listen(PORT, () => {
      console.log(`✓ Logistics Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start logistics server:", error);
    process.exit(1);
  }
};

start();

export default app;
