import { Router } from "express";
import { vestingController } from "../controllers/vesting.controller";

const router = Router();

// Frontend: تسجيل سحب من Vesting
router.post("/claim", vestingController.claimVesting);

// Frontend: جلب حالة الاستحقاق
router.get("/status/:wallet", vestingController.vestingStatus);

// Frontend: جلب سجل السحوبات
router.get("/claims/:wallet", vestingController.vestingClaims);

export default router;