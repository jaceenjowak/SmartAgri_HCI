const express = require("express");
const router = express.Router();
const {
  controlPump,
  getLogs,
  getPumpStatus,
} = require("../controllers/irrigationController");
const { protect } = require("../middleware/authMiddleware");

router.post("/control", protect, controlPump);
router.get("/logs", protect, getLogs);
router.get("/pump-status", protect, getPumpStatus);

module.exports = router;
