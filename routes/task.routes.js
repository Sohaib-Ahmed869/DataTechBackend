const express = require("express");
const {
  getAllTasks,
  getTaskById,
  assignAgentToTask,
  updateTaskStatus,
} = require("../controllers/task.controller");

const router = express.Router();
const { auth } = require("../middleware/auth.middleware");

// Get all tasks (grouped by status)
router.get("/", auth, getAllTasks);

// Get single task by ID
router.get("/:id", auth, getTaskById);

// Assign agent to lead task
router.put("/:id/assign", auth, assignAgentToTask);

// Update task status
router.patch("/:id/status", auth, updateTaskStatus);

module.exports = router;
