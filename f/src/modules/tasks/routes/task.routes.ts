import { Router } from "express";
import { tasksController } from "../controllers/task.controller";

const router = Router();

/**
 * 🧭 مسارات نظام المهام الاجتماعية
 */

// جلب قائمة المهام النشطة
router.get("/list", tasksController.listTasks);

// إكمال مهمة
router.post("/complete", tasksController.completeTask);

// جلب حالة مهام مستخدم معين
router.get("/status", tasksController.getStatus);

export default router;
