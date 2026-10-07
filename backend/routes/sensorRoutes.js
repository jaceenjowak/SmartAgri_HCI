const router=require('express').Router();
const {protect,adminOnly}=require('../middleware/authMiddleware');
const sensor=require('../controllers/sensorController');
router.post('/reading',protect,sensor.postReading); // no hardware in Phase 1
router.post('/simulate',protect,sensor.simulateReading);
router.get('/latest',protect,sensor.getLatest);
router.get('/history',protect,sensor.getHistory);
router.get('/all',protect,adminOnly,sensor.getAllReadings);
module.exports=router;
