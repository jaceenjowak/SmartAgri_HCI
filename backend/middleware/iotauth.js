const crypto = require('node:crypto');

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function iotProtect(req, res, next) {
  const expectedId = process.env.IOT_DEVICE_ID;
  const expectedKey = process.env.IOT_DEVICE_KEY;
  const receivedId = req.get('X-Device-Id');
  const receivedKey = req.get('X-Device-Key');

  if (!expectedId || !expectedKey || expectedKey.length < 24) {
    return res.status(503).json({ message: 'IoT device authentication is not configured. Set IOT_DEVICE_ID and a strong IOT_DEVICE_KEY in backend/.env.' });
  }
  if (!safeEqual(receivedId, expectedId) || !safeEqual(receivedKey, expectedKey)) {
    return res.status(401).json({ message: 'Invalid IoT device credentials.' });
  }
  const userId = Number(process.env.IOT_USER_ID);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(503).json({ message: 'IoT device owner is not configured. Set IOT_USER_ID to the SmartAgri account ID.' });
  }
  req.device = { id: receivedId };
  req.deviceUserId = userId;
  next();
}

module.exports = { iotProtect };
