import express from "express"
import { postFeedback } from "../controllers/feedbackController.js"
import { requireAuth } from "../middleware/auth.js"

const router = express.Router()

router.post("/feedback", requireAuth, postFeedback)

export default router
