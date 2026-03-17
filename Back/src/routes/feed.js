import express from "express"
import {
  deleteFeedPostHandler,
  getFeedActivityCountHandler,
  getFeedComments,
  getFeedPosts,
  postFeedComment,
  postFeedHighlight,
  postFeedLike,
  postFeedPost,
  putFeedPost,
} from "../controllers/feedController.js"

const router = express.Router()

router.get("/feed/posts", getFeedPosts)
router.get("/feed/activity-count", getFeedActivityCountHandler)
router.post("/feed/posts", postFeedPost)
router.put("/feed/posts/:id", putFeedPost)
router.delete("/feed/posts/:id", deleteFeedPostHandler)
router.post("/feed/posts/:id/curtir", postFeedLike)
router.get("/feed/posts/:id/comentarios", getFeedComments)
router.post("/feed/posts/:id/comentarios", postFeedComment)
router.post("/feed/posts/:id/destaque", postFeedHighlight)

export default router
