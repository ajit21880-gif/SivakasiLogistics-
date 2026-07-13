import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../app.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Validation Schema for GC Creation
const GcSchema = z.object({
  consignorId: z.string(),
  consigneeId: z.string(),
  fromCity: z.string().default("SIVAKASI"),
  toCity: z.string(),
  invoiceNo: z.string(),
  invoiceDate: z.string().optional().nullable(),
  value: z.number().default(0.0),
  mark: z.string().optional().nullable(),
  godown: z.string().optional().nullable(),
  delivery: z.string().optional().nullable(),
  hamali: z.number().default(0.0),
  stCharges: z.number().default(0.0),
  others: z.number().default(0.0),
  charWt: z.number().default(0.0),
  rateKg: z.number().default(0.0),
  serviceTaxPercent: z.number().default(5.0),
  paymentStatus: z.enum(["To/Pay", "Paid", "TBB"]).default("To/Pay"),
  quantity: z.number().int().default(0),
  saidToContainCode: z.string().optional().nullable(),
  saidToContainDesc: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  printType: z.string().default("LORRY COPY"),
  serviceTaxPayableBy: z.enum(["Consignee", "Consignor", "Transporter"]).default("Consignee"),
});

// GET /v1/gc - Get all Goods Consignments (filtered by role and query params)
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let where: any = {};

    if (req.userRole === "customer") {
      // Find the logged-in customer's user mappings
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user || (!user.linkedConsignorId && !user.linkedConsigneeId)) {
        return res.json({ success: true, data: [] });
      }

      // Customers can only see APPROVED consignments where they are Consignor OR Consignee
      where = {
        approvalStatus: "APPROVED",
        OR: [
          user.linkedConsignorId ? { consignorId: user.linkedConsignorId } : {},
          user.linkedConsigneeId ? { consigneeId: user.linkedConsigneeId } : {},
        ].filter(item => Object.keys(item).length > 0),
      };
    } else {
      // Admin and Staff can filter by approvalStatus query parameter if provided
      const { status } = req.query;
      if (status) {
        where.approvalStatus = String(status);
      }
    }

    const consignments = await prisma.goodsConsignment.findMany({
      where,
      include: {
        consignor: true,
        consignee: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: consignments });
  } catch (error) {
    console.error("Error fetching GCs:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /v1/gc/pending - Get pending GCs (Admin only)
router.get("/pending", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const pending = await prisma.goodsConsignment.findMany({
      where: { approvalStatus: "PENDING_APPROVAL" },
      include: {
        consignor: true,
        consignee: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /v1/gc - Create new Goods Consignment (Data Entry)
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole === "customer") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Check staff permissions
    if (req.userRole === "staff") {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      // View only staff cannot create or edit
      if (user?.staffPermission === "ENTER_VIEW" && req.body.id) {
        return res.status(403).json({ success: false, message: "Permission Denied: VIEW ONLY staff cannot edit records" });
      }
    }

    const data = GcSchema.parse(req.body);

    // Calculate figures
    const freight = data.charWt * data.rateKg;
    const serviceTax = freight * (data.serviceTaxPercent / 100);
    // User requested Total = Cargo Value + Freight + Service Tax + Hamali + Stationary Charges + Others
    const total = data.value + freight + serviceTax + data.hamali + data.stCharges + data.others;

    // Generate unique GC Number (e.g., D02249)
    const count = await prisma.goodsConsignment.count();
    const nextNum = (2249 + count).toString().padStart(5, "0");
    const gcNumber = `D${nextNum}`;

    // Status: Staff submissions require admin approval, Admin is auto-approved
    const approvalStatus = req.userRole === "admin" ? "APPROVED" : "PENDING_APPROVAL";

    const consignment = await prisma.goodsConsignment.create({
      data: {
        ...data,
        gcNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        freight,
        serviceTax,
        total,
        approvalStatus,
        enteredById: req.userId || null,
        enteredByName: req.userName || null,
      },
      include: {
        consignor: true,
        consignee: true,
      },
    });

    res.status(201).json({
      success: true,
      message: approvalStatus === "APPROVED" ? "Consignment saved successfully" : "Consignment submitted for Admin approval",
      data: consignment,
    });
  } catch (error) {
    console.error("Create GC error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /v1/gc/:id - Update Goods Consignment
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

    const data = GcSchema.partial().parse(req.body);

    const existing = await prisma.goodsConsignment.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Consignment not found" });
    }

    // Recalculate calculations
    const charWt = data.charWt !== undefined ? data.charWt : existing.charWt;
    const rateKg = data.rateKg !== undefined ? data.rateKg : existing.rateKg;
    const value = data.value !== undefined ? data.value : existing.value;
    const hamali = data.hamali !== undefined ? data.hamali : existing.hamali;
    const stCharges = data.stCharges !== undefined ? data.stCharges : existing.stCharges;
    const others = data.others !== undefined ? data.others : existing.others;
    const serviceTaxPercent = data.serviceTaxPercent !== undefined ? data.serviceTaxPercent : existing.serviceTaxPercent;

    const freight = charWt * rateKg;
    const serviceTax = freight * (serviceTaxPercent / 100);
    const total = value + freight + serviceTax + hamali + stCharges + others;

    // Staff changes trigger PENDING_APPROVAL status. Admin is auto-approved.
    const approvalStatus = req.userRole === "admin" ? "APPROVED" : "PENDING_APPROVAL";

    const updated = await prisma.goodsConsignment.update({
      where: { id: req.params.id },
      data: {
        ...data,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : (data.invoiceDate === null ? null : existing.invoiceDate),
        freight,
        serviceTax,
        total,
        approvalStatus,
        enteredById: req.userId || existing.enteredById,
        enteredByName: req.userName || existing.enteredByName,
      },
      include: {
        consignor: true,
        consignee: true,
      },
    });

    res.json({
      success: true,
      message: approvalStatus === "APPROVED" ? "Consignment updated successfully" : "Consignment updates submitted for Admin approval",
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /v1/gc/:id/approve - Approve a consignment (Admin only)
router.post("/:id/approve", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const updated = await prisma.goodsConsignment.update({
      where: { id: req.params.id },
      data: { approvalStatus: "APPROVED" },
    });

    res.json({ success: true, message: "Consignment approved successfully", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /v1/gc/:id/reject - Reject a consignment (Admin only)
router.post("/:id/reject", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const updated = await prisma.goodsConsignment.update({
      where: { id: req.params.id },
      data: { approvalStatus: "REJECTED" },
    });

    res.json({ success: true, message: "Consignment rejected", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /v1/gc/:id/dispatches - Get all dispatch details (lorries, quantities) for this consignment (Requirement 4)
router.get("/:id/dispatches", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const dispatches = await prisma.gDMItem.findMany({
      where: { goodsConsignmentId: req.params.id },
      include: {
        gdm: {
          include: {
            lorry: true,
          },
        },
      },
      orderBy: { gdm: { gdmDate: "desc" } },
    });

    const list = dispatches.map(item => ({
      gdmNumber: item.gdm.gdmNumber,
      gdmDate: item.gdm.gdmDate,
      lorryNumber: item.gdm.lorry.lorryNumber,
      lorryName: item.gdm.lorry.lorryName,
      driverName: item.gdm.lorry.driverName,
      driverContact: item.gdm.lorry.driverContact,
      totalQty: item.qty,
      despQty: item.desp,
      serviceTax: item.serviceTax,
      deliveryStatus: item.gdm.deliveryStatus,
    }));

    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
