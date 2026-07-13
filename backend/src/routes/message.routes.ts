import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../app.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

// POST /messages - Create/send message
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { gdmId, content } = z
      .object({
        gdmId: z.string(),
        content: z.string().min(1),
      })
      .parse(req.body);

    // Fetch dispatch details to find the lorry owner contact
    const gdm = await prisma.goodsDispatchMemo.findUnique({
      where: { id: gdmId },
      include: { lorry: true },
    });

    if (!gdm) {
      return res.status(404).json({ success: false, message: "Dispatch GDM not found" });
    }

    const senderName = req.userName || "Customer User";
    const receiverContact = gdm.lorry.ownerContact; // Sending to lorry owner

    const msg = await prisma.transportMessage.create({
      data: {
        gdmId,
        senderId: req.userId!,
        senderName,
        receiverContact,
        content,
      },
    });

    // Simulate sending email to transport owner
    console.log(`[Email Simulation] Sent email to lorry owner (${gdm.lorry.ownerName} - ${gdm.lorry.ownerContact}) from ${senderName}: "${content}"`);

    res.status(201).json({
      success: true,
      message: "Message dispatched and email notification sent to Transport Owner",
      data: msg,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /messages/:gdmId - Get message logs for a dispatch memo
router.get("/:gdmId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const list = await prisma.transportMessage.findMany({
      where: { gdmId: req.params.gdmId },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
