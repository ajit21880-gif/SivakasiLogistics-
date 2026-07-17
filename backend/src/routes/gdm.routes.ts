import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../app.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Validation Schema for GDM Item Input
const GdmItemSchema = z.object({
  goodsConsignmentId: z.string(),
  desp: z.number().int().nonnegative(),
  serviceTax: z.number().nonnegative().default(0.0),
});

// Validation Schema for GDM Creation
const CreateGdmSchema = z.object({
  fromCity: z.string().default("SIVAKASI"),
  toCity: z.string(),
  lorryId: z.string(),
  remarks: z.string().optional().nullable(),
  items: z.array(GdmItemSchema).min(1),
  deliveryStatus: z.enum(["pending", "loaded", "in_transit", "delivered"]).default("pending"),
});

// GET /v1/gdm - List all Goods Dispatch Memos (with role filters)
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let where: any = {};

    // Customer role filter: only see GDMs that contain their cargo
    if (req.userRole === "customer") {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user || (!user.linkedConsignorId && !user.linkedConsigneeId)) {
        return res.json({ success: true, data: [] });
      }

      where = {
        approvalStatus: "APPROVED",
        items: {
          some: {
            consignment: {
              OR: [
                user.linkedConsignorId ? { consignorId: user.linkedConsignorId } : {},
                user.linkedConsigneeId ? { consigneeId: user.linkedConsigneeId } : {},
              ].filter(item => Object.keys(item).length > 0),
            },
          },
        },
      };
    } else {
      // Admin and Staff can filter by approvalStatus query parameter if provided
      const { status } = req.query;
      if (status) {
        where.approvalStatus = String(status);
      }
    }

    const list = await prisma.goodsDispatchMemo.findMany({
      where,
      include: {
        lorry: true,
        items: {
          include: {
            consignment: {
              include: {
                consignor: true,
                consignee: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: list });
  } catch (error) {
    console.error("GDM list error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /v1/gdm/audit-report - Admin-only audit report
router.get("/audit-report", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const auditList = await prisma.goodsDispatchMemo.findMany({
      select: {
        gdmNumber: true,
        gdmDate: true,
        fromCity: true,
        toCity: true,
        lorry: { select: { lorryNumber: true } },
        deliveryStatus: true,
        approvalStatus: true,
        totalDesp: true,
        lastUpdatedBy: true,
        lastUpdatedByName: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ success: true, data: auditList });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /v1/gdm/next-number - Get the next auto-generated GDM Number
router.get("/next-number", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.goodsDispatchMemo.count();
    const nextNum = (143 + count).toString().padStart(5, "0");
    const gdmNumber = `D${nextNum}`;
    res.json({ success: true, gdmNumber });
  } catch (error) {
    console.error("Error fetching next GDM number:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /v1/gdm/daily-report - Get daily overview report of bookings and dispatches
router.get("/daily-report", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query; // Date formatted as YYYY-MM-DD
    if (!date) {
      return res.status(400).json({ success: false, message: "Date parameter is required" });
    }

    const targetDate = new Date(String(date));
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    // Set start and end range for the specified day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch consignments booked on this date
    const consignments = await prisma.goodsConsignment.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        consignor: true,
        consignee: true
      },
      orderBy: { createdAt: "desc" }
    });

    // Fetch dispatches made on this date
    const dispatches = await prisma.goodsDispatchMemo.findMany({
      where: {
        gdmDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        lorry: true,
        items: {
          include: {
            consignment: {
              include: {
                consignor: true,
                consignee: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      success: true,
      data: {
        consignments,
        dispatches
      }
    });
  } catch (error) {
    console.error("Daily report error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /v1/gdm - Create GDM (autofills Number, aggregates totals, and audits creator)
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole === "customer") {
      return res.status(403).json({ success: false, message: "Forbidden: Customers cannot create GDMs" });
    }

    // Check staff permissions
    if (req.userRole === "staff") {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.staffPermission === "ENTER_VIEW" && req.body.id) {
        return res.status(403).json({ success: false, message: "Permission Denied: VIEW ONLY staff cannot edit records" });
      }
    }

    const data = CreateGdmSchema.parse(req.body);

    // Auto-generate GDM Number (e.g. D00143)
    const count = await prisma.goodsDispatchMemo.count();
    const nextNum = (143 + count).toString().padStart(5, "0");
    const gdmNumber = `D${nextNum}`;

    // Get staff loginId/Name for audit
    const lastUpdatedBy = req.userName || "STF01";
    const lastUpdatedByName = req.userName || "Staff";

    // Status: Staff submissions require admin approval, Admin is auto-approved
    const approvalStatus = req.userRole === "admin" ? "APPROVED" : "PENDING_APPROVAL";

    // Gather quantities and service taxes
    let totalQty = 0;
    let totalDesp = 0;
    let totalServiceTax = 0.0;

    const itemsData = [];

    for (const item of data.items) {
      const consignment = await prisma.goodsConsignment.findUnique({
        where: { id: item.goodsConsignmentId }
      });
      if (!consignment) {
        return res.status(404).json({ success: false, message: `Consignment ID ${item.goodsConsignmentId} not found` });
      }

      totalQty += consignment.quantity;
      totalDesp += item.desp;
      totalServiceTax += item.serviceTax;

      itemsData.push({
        goodsConsignmentId: item.goodsConsignmentId,
        qty: consignment.quantity,
        desp: item.desp,
        serviceTax: item.serviceTax
      });
    }

    // Create GDM and GDMItems in a transaction
    const gdm = await prisma.goodsDispatchMemo.create({
      data: {
        gdmNumber,
        fromCity: data.fromCity,
        toCity: data.toCity,
        lorryId: data.lorryId,
        remarks: data.remarks,
        totalQty,
        totalDesp,
        totalServiceTax,
        deliveryStatus: data.deliveryStatus,
        approvalStatus,
        enteredById: req.userId || null,
        enteredByName: req.userName || null,
        lastUpdatedBy,
        lastUpdatedByName,
        items: {
          create: itemsData
        }
      },
      include: {
        lorry: true,
        items: {
          include: {
            consignment: {
              include: {
                consignor: true,
                consignee: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: approvalStatus === "APPROVED" ? "GDM Dispatch created successfully" : "GDM Dispatch submitted for Admin approval",
      data: gdm
    });
  } catch (error) {
    console.error("Create GDM error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /v1/gdm/:id - Update GDM (modifies status, items, and audit-logs editor)
router.put("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole === "customer") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Check staff permissions
    if (req.userRole === "staff") {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.staffPermission === "ENTER_VIEW") {
        return res.status(403).json({ success: false, message: "Permission Denied: Staff has View/Enter Only access and cannot edit existing records" });
      }
    }

    const data = CreateGdmSchema.partial().parse(req.body);

    const existing = await prisma.goodsDispatchMemo.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Dispatch memo not found" });
    }

    // Get editor audit log
    const lastUpdatedBy = req.userName || "STF01";
    const lastUpdatedByName = req.userName || "Staff";

    const approvalStatus = req.userRole === "admin" ? "APPROVED" : "PENDING_APPROVAL";

    let updateData: any = {
      fromCity: data.fromCity !== undefined ? data.fromCity : existing.fromCity,
      toCity: data.toCity !== undefined ? data.toCity : existing.toCity,
      lorryId: data.lorryId !== undefined ? data.lorryId : existing.lorryId,
      remarks: data.remarks !== undefined ? data.remarks : existing.remarks,
      deliveryStatus: data.deliveryStatus !== undefined ? data.deliveryStatus : existing.deliveryStatus,
      approvalStatus,
      lastUpdatedBy,
      lastUpdatedByName
    };

    // If items are being updated, recalculate totals
    if (data.items) {
      // Clear old items and write new ones
      await prisma.gDMItem.deleteMany({ where: { gdmId: req.params.id } });

      let totalQty = 0;
      let totalDesp = 0;
      let totalServiceTax = 0.0;

      const itemsData = [];

      for (const item of data.items) {
        const consignment = await prisma.goodsConsignment.findUnique({
          where: { id: item.goodsConsignmentId }
        });
        if (!consignment) {
          return res.status(404).json({ success: false, message: `Consignment ID ${item.goodsConsignmentId} not found` });
        }

        totalQty += consignment.quantity;
        totalDesp += item.desp;
        totalServiceTax += item.serviceTax;

        itemsData.push({
          goodsConsignmentId: item.goodsConsignmentId,
          qty: consignment.quantity,
          desp: item.desp,
          serviceTax: item.serviceTax
        });
      }

      updateData.totalQty = totalQty;
      updateData.totalDesp = totalDesp;
      updateData.totalServiceTax = totalServiceTax;
      updateData.items = {
        create: itemsData
      };
    }

    const updated = await prisma.goodsDispatchMemo.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        lorry: true,
        items: {
          include: {
            consignment: {
              include: {
                consignor: true,
                consignee: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      message: approvalStatus === "APPROVED" ? "GDM updated successfully" : "GDM updates submitted for Admin approval",
      data: updated
    });
  } catch (error) {
    console.error("Update GDM error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /v1/gdm/:id/approve - Approve GDM (Admin only)
router.post("/:id/approve", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const updated = await prisma.goodsDispatchMemo.update({
      where: { id: req.params.id },
      data: { approvalStatus: "APPROVED" },
    });

    res.json({ success: true, message: "GDM Dispatch approved successfully", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /v1/gdm/:id/reject - Reject GDM (Admin only)
router.post("/:id/reject", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const updated = await prisma.goodsDispatchMemo.update({
      where: { id: req.params.id },
      data: { approvalStatus: "REJECTED" },
    });

    res.json({ success: true, message: "GDM Dispatch rejected", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
