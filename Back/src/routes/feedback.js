import express from "express"
import { listFeedbacks, postFeedback } from "../controllers/feedbackController.js"
import { requireAuth, requireRole } from "../middleware/auth.js"

const router = express.Router()

router.post("/feedback", requireAuth, postFeedback)
router.get("/superadmin/feedbacks", requireAuth, requireRole("SUPERADMIN"), listFeedbacks)

export default router
