const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('ESP32 route module exposes all firmware endpoints', () => {
  const routes = fs.readFileSync(path.join(root, 'routes/iotroutes.js'), 'utf8');
  for (const route of ["router.post('/reading'", "router.get('/pump-command'", "router.post('/pump-status'"]) assert.ok(routes.includes(route), `missing route: ${route}`);
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(server, /app\.use\('\/api\/iot', require\('\.\/routes\/iotroutes'\)\)/);
});

test('device authentication rejects missing and incorrect credentials', () => {
  const { iotProtect } = require('../middleware/iotauth');
  const old = { id: process.env.IOT_DEVICE_ID, key: process.env.IOT_DEVICE_KEY, user: process.env.IOT_USER_ID };
  process.env.IOT_DEVICE_ID = 'test-device';
  process.env.IOT_DEVICE_KEY = 'a'.repeat(40);
  process.env.IOT_USER_ID = '7';
  const response = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
  try {
    const denied = response();
    iotProtect({ get: (name) => name === 'X-Device-Id' ? 'test-device' : 'wrong' }, denied, () => assert.fail('invalid key must not pass'));
    assert.equal(denied.statusCode, 401);
    const accepted = response();
    let passed = false;
    const req = { get: (name) => name === 'X-Device-Id' ? 'test-device' : 'a'.repeat(40) };
    iotProtect(req, accepted, () => { passed = true; });
    assert.equal(passed, true);
    assert.equal(req.deviceUserId, 7);
  } finally {
    for (const [k, v] of [['IOT_DEVICE_ID', old.id], ['IOT_DEVICE_KEY', old.key], ['IOT_USER_ID', old.user]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('notification UI refreshes and handles API failures without silent mark-read errors', () => {
  const page = fs.readFileSync(path.join(root, '../frontend/src/pages/Notifications.jsx'), 'utf8');
  const bell = fs.readFileSync(path.join(root, '../frontend/src/components/NotificationBell.jsx'), 'utf8');
  assert.match(page, /setInterval\(\(\) => load\(\{ quiet: true \}\), 5000\)/);
  assert.match(page, /catch \(e\) \{ setError/);
  assert.match(bell, /notifications-updated/);
});


test('browser route contracts are present in backend routers', () => {
  const expected = [
    ['routes/authRoutes.js', "router.post(\"/register\"", "router.post(\"/login\"", "router.get(\"/me\""],
    ['routes/sensorRoutes.js', "router.get('/latest'", "router.get('/history'", "router.post('/simulate'"],
    ['routes/irrigationRoutes.js', 'router.post("/control"', 'router.get("/logs"', 'router.get("/pump-status"'],
    ['routes/notificationRoutes.js', 'router.get("/"', 'router.get("/unread-count"', 'router.patch("/read-all"', 'router.patch("/:id/read"'],
    ['routes/thresholdRoutes.js', 'router.get("/"', 'router.put("/"'],
  ];
  for (const [file, ...routes] of expected) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const route of routes) assert.ok(source.includes(route), `${file} missing ${route}`);
  }
});
