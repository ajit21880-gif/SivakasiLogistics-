import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../app.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Zod schemas
const ConsignorSchema = z.object({
  name: z.string(),
  origin: z.string(),
  gstn: z.string().min(15).max(15),
  mobile: z.string().min(10),
});

const ConsigneeSchema = z.object({
  name: z.string(),
  destination: z.string(),
  gstn: z.string().min(15).max(15),
  mobile: z.string().min(10),
});

const LorrySchema = z.object({
  lorryNumber: z.string(),
  lorryName: z.string(),
  ownerName: z.string(),
  ownerContact: z.string().min(10),
  driverName: z.string(),
  driverContact: z.string().min(10),
  drivingLicenseNumber: z.string(),
});

// === CONSIGNOR MASTERS ===

// GET /master/consignors
router.get("/consignors", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const list = await prisma.consignorMaster.findMany({
      orderBy: { name: "asc" }
    });
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /master/consignors
router.post("/consignors", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = ConsignorSchema.parse(req.body);
    const consignor = await prisma.consignorMaster.create({ data });
    res.status(201).json({ success: true, message: "Consignor master created", data: consignor });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /master/consignors/bulk - Bulk import Consignors
router.post("/consignors/bulk", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const { items } = z.object({ items: z.array(ConsignorSchema) }).parse(req.body);
    
    // Create items
    const createdCount = await prisma.$transaction(
      items.map(item =>
        prisma.consignorMaster.create({
          data: item
        })
      )
    );

    res.status(201).json({ success: true, message: `Successfully imported ${createdCount.length} Consignors` });
  } catch (error) {
    console.error("Bulk Consignors error:", error);
    res.status(400).json({ success: false, message: "Invalid data or validation error during import" });
  }
});


// === CONSIGNEE MASTERS ===

// GET /master/consignees
router.get("/consignees", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const list = await prisma.consigneeMaster.findMany({
      orderBy: { name: "asc" }
    });
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /master/consignees
router.post("/consignees", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = ConsigneeSchema.parse(req.body);
    const consignee = await prisma.consigneeMaster.create({ data });
    res.status(201).json({ success: true, message: "Consignee master created", data: consignee });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /master/consignees/bulk - Bulk import Consignees
router.post("/consignees/bulk", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const { items } = z.object({ items: z.array(ConsigneeSchema) }).parse(req.body);

    const createdCount = await prisma.$transaction(
      items.map(item =>
        prisma.consigneeMaster.create({
          data: item
        })
      )
    );

    res.status(201).json({ success: true, message: `Successfully imported ${createdCount.length} Consignees` });
  } catch (error) {
    console.error("Bulk Consignees error:", error);
    res.status(400).json({ success: false, message: "Invalid data or validation error during import" });
  }
});


// === LORRY MASTERS ===

// GET /master/lorries
router.get("/lorries", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const list = await prisma.lorryMaster.findMany({
      orderBy: { lorryNumber: "asc" }
    });
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /master/lorries
router.post("/lorries", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = LorrySchema.parse(req.body);
    
    // Check unique lorry
    const existing = await prisma.lorryMaster.findUnique({
      where: { lorryNumber: data.lorryNumber }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "Lorry number already registered" });
    }

    const lorry = await prisma.lorryMaster.create({ data });
    res.status(201).json({ success: true, message: "Lorry master created", data: lorry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /master/lorries/bulk - Bulk import Lorries
router.post("/lorries/bulk", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }

    const { items } = z.object({ items: z.array(LorrySchema) }).parse(req.body);

    const operations = [];
    for (const item of items) {
      operations.push(
        prisma.lorryMaster.upsert({
          where: { lorryNumber: item.lorryNumber },
          update: item,
          create: item,
        })
      );
    }

    const results = await prisma.$transaction(operations);

    res.status(201).json({ success: true, message: `Successfully imported/updated ${results.length} Lorries` });
  } catch (error) {
    console.error("Bulk Lorries error:", error);
    res.status(400).json({ success: false, message: "Invalid data or validation error during import" });
  }
});

export default router;
