import express from "express"
import {
  deleteFeedPostHandler,
  getFeedActivityCountHandler,
  getFeedComments,
  getFeedPosts,
  getFeedRecipients,
  postFeedComment,
  postFeedHighlight,
  postFeedLike,
  postFeedPost,
  putFeedPost,
} from "../controllers/feedController.js"
import { requireAuth } from "../middleware/auth.js"

const router = express.Router()

router.use(requireAuth)

router.get("/feed/posts", getFeedPosts)
router.get("/feed/usuarios", getFeedRecipients)
router.get("/feed/activity-count", getFeedActivityCountHandler)
router.post("/feed/posts", postFeedPost)
router.put("/feed/posts/:id", putFeedPost)
router.delete("/feed/posts/:id", deleteFeedPostHandler)
router.post("/feed/posts/:id/curtir", postFeedLike)
router.get("/feed/posts/:id/comentarios", getFeedComments)
router.post("/feed/posts/:id/comentarios", postFeedComment)
router.post("/feed/posts/:id/destaque", postFeedHighlight)

export default router
