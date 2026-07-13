import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../app.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

const LoginSchema = z.object({
  loginId: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  phone: z.string(),
  password: z.string().min(6),
  firstName: z.string(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "staff", "customer"]).default("staff"),
  loginId: z.string(),
});

// POST /login - Access token generation
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { loginId, email, password } = LoginSchema.parse(req.body);

    if (!loginId && !email) {
      return res.status(400).json({
        success: false,
        message: "Either loginId or email is required",
      });
    }

    // Find User
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          loginId ? { loginId } : {},
          email ? { email } : {},
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify Approval Status
    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        error: "PENDING_APPROVAL",
        message: "Your registration is pending Admin approval. Please contact management.",
      });
    }

    // Verify Password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate Token
    const jwtSecret = process.env.JWT_SECRET || "sivakasi-logistics-super-secret-key-1234";
    const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });

    res.json({
      success: true,
      message: "Login successful",
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        loginId: user.loginId,
        staffPermission: user.staffPermission,
        isDefaultPassword: user.isDefaultPassword,
        linkedConsignorId: user.linkedConsignorId,
        linkedConsigneeId: user.linkedConsigneeId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: error.errors[0].message,
      });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /register - Create user (defaults to pending approval)
router.post("/register", async (req: Request, res: Response) => {
  try {
    const data = RegisterSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { phone: data.phone },
          { loginId: data.loginId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User with this email, phone, or loginId already exists",
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    // Newly registered users are pending approval by default
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        loginId: data.loginId,
        isApproved: false,
        isDefaultPassword: false, // User chose their own password during registration
      },
    });

    res.status(201).json({
      success: true,
      message: "Registration successful! Waiting for Admin approval.",
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        loginId: user.loginId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: error.errors[0].message,
      });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /v1/auth/users/pending - List pending registrations (Admin only)
router.get("/users/pending", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const list = await prisma.user.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /v1/auth/users/:id/approve - Approve user registration (Admin only)
router.post("/users/:id/approve", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isApproved: true },
    });

    res.json({ success: true, message: "User approved successfully", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /v1/auth/users/:id/reject - Reject/Delete user (Admin only)
router.post("/users/:id/reject", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: "User registration rejected and deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /v1/auth/users/staff - Get list of staff users (Admin only)
router.get("/users/staff", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const staffList = await prisma.user.findMany({
      where: { role: "staff", isApproved: true },
      orderBy: { loginId: "asc" },
    });

    res.json({ success: true, data: staffList });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /v1/auth/users/:id/staff-permissions - Toggle staff edit permissions (Admin only)
router.put("/users/:id/staff-permissions", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { staffPermission } = z.object({ staffPermission: z.enum(["EDIT", "ENTER_VIEW"]) }).parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { staffPermission },
    });

    res.json({ success: true, message: "Staff permissions updated", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /v1/auth/users/create-customer - Create customer login (Admin only)
router.post("/users/create-customer", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const customerSchema = z.object({
      loginId: z.string(),
      email: z.string().email(),
      phone: z.string(),
      firstName: z.string(),
      lastName: z.string().optional(),
      defaultPassword: z.string().min(6),
      linkedConsignorId: z.string().optional().nullable(),
      linkedConsigneeId: z.string().optional().nullable(),
    });

    const data = customerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { phone: data.phone },
          { loginId: data.loginId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "User email, phone, or Login ID already exists" });
    }

    const passwordHash = await bcrypt.hash(data.defaultPassword, 12);

    const user = await prisma.user.create({
      data: {
        loginId: data.loginId,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        role: "customer",
        passwordHash,
        isApproved: true,
        isDefaultPassword: true, // Requires them to change on first login
        linkedConsignorId: data.linkedConsignorId || null,
        linkedConsigneeId: data.linkedConsigneeId || null,
      },
    });

    res.status(201).json({ success: true, message: "Customer account created successfully", data: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /v1/auth/users/customers - List all active customers (Admin only)
router.get("/users/customers", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const customers = await prisma.user.findMany({
      where: { role: "customer", isApproved: true },
      orderBy: { loginId: "asc" },
    });

    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /v1/auth/users/:id/link-customer - Update customer consignor/consignee links (Admin only)
router.put("/users/:id/link-customer", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const linkSchema = z.object({
      linkedConsignorId: z.string().optional().nullable(),
      linkedConsigneeId: z.string().optional().nullable(),
    });

    const data = linkSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        linkedConsignorId: data.linkedConsignorId,
        linkedConsigneeId: data.linkedConsigneeId,
      },
    });

    res.json({ success: true, message: "Customer link accounts updated successfully", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /change-password - Change user password (all authenticated users)
router.post("/change-password", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const passwordSchema = z.object({
      oldPassword: z.string(),
      newPassword: z.string().min(6),
    });

    const { oldPassword, newPassword } = passwordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Verify Old Password
    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Incorrect current password" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        passwordHash,
        isDefaultPassword: false, // Clears first-time password change lock
      },
    });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
