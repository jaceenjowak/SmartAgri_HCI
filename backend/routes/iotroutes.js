const router = require('express').Router();
const { iotProtect } = require('../middleware/iotauth');
const { postReading, getPumpCommand, postPumpStatus } = require('../controllers/iotcontroller');

// Device-only endpoints; do not protect these with the user JWT middleware.
router.post('/reading', iotProtect, postReading);
router.get('/pump-command', iotProtect, getPumpCommand);
router.post('/pump-status', iotProtect, postPumpStatus);

module.exports = router;
