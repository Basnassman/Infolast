import { Router } from "express";
import { purchaseController } from "../controllers/purchase.controller";

const router = Router();

router.post("/webhook", purchaseController.purchaseWebhook);
router.post("/claim", purchaseController.claimPurchaseTokens);
router.get("/status/:wallet", purchaseController.userStatus);

export default router;
