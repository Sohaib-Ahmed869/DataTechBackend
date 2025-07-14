const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth.middleware");
const {
  getAllBlogs,
  getBlog,
  createBlog,
  updateBlog,
  deleteBlog,
  incrementViews,
  getBlogViewAnalytics,
  toggleLike,
  addComment,
} = require("../controllers/blog.controller");
const { upload } = require("../utils/UploadImage");

// Public routes
router.get("/", getAllBlogs);
router.get("/:id", getBlog);
router.post("/:id/view", incrementViews);

// Protected routes (admin only)
router.post("/", auth, upload.single("image"), createBlog);
router.put("/:id", auth, upload.single("image"), updateBlog);
router.delete("/:id", auth, deleteBlog);
router.get("/:id/analytics", auth, getBlogViewAnalytics);

// Like/unlike a blog
router.post("/:id/like", auth, toggleLike);
// Add a comment to a blog
router.post("/:id/comment", auth, addComment);

module.exports = router;
