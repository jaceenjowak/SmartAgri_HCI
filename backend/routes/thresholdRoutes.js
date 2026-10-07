const express = require("express");
const router = express.Router();
const {
  getThresholds,
  updateThresholds,
} = require("../controllers/thresholdController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getThresholds);
router.put("/", protect, updateThresholds);

module.exports = router;
