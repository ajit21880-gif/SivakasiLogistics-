import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../app.js";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userName?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET || "sivakasi-logistics-super-secret-key-1234";

    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    
    // Fetch user details
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "User not found or deleted",
      });
    }

    // Attach user payload
    req.userId = user.id;
    req.userRole = user.role;
    req.userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.loginId || "Unknown";

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "INVALID_TOKEN",
      message: "Invalid or expired authorization token",
    });
  }
};
