import express from "express"
import { postFeedback } from "../controllers/feedbackController.js"

const router = express.Router()

router.post("/feedback", postFeedback)

export default router
