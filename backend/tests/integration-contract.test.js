const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sbPath = require.resolve('../config/supabase');
require.cache[sbPath] = { id: sbPath, filename: sbPath, loaded: true, exports: {} };
const sensors = require('../controllers/sensorController');
const irrigation = require('../controllers/irrigationController');
const thresholds = require('../controllers/thresholdController');

const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });

test('invalid sensor percentage is rejected before database access', async () => {
  process.env.ENABLE_SIMULATION = 'true';
  const res = response();
  await sensors.simulateReading({ user: { id: 1 }, body: { moisture_percent: 101, water_detected: true } }, res);
  assert.equal(res.statusCode, 400);
});

test('invalid manual pump action is rejected before database access', async () => {
  process.env.ENABLE_SIMULATION = 'true';
  const res = response();
  await irrigation.controlPump({ user: { id: 1 }, body: { action: 'start' } }, res);
  assert.equal(res.statusCode, 400);
});

test('bad threshold order is rejected before database access', async () => {
  const res = response();
  await thresholds.updateThresholds({ user: { id: 1 }, body: { dry_threshold: 80, wet_threshold: 30, auto_irrigation: true } }, res);
  assert.equal(res.statusCode, 400);
});

test('legacy user-authenticated sensor ingestion is retired in favor of device-authenticated IoT routes', () => {
  const res = response();
  sensors.postReading({}, res);
  assert.equal(res.statusCode, 410);
});

test('backend controllers no longer depend on MySQL', () => {
  const root = path.resolve(__dirname, '..');
  for (const folder of ['controllers', 'routes', 'config']) {
    for (const name of fs.readdirSync(path.join(root, folder))) {
      if (!name.endsWith('.js')) continue;
      const source = fs.readFileSync(path.join(root, folder, name), 'utf8');
      assert.doesNotMatch(source, /mysql2|config\/db/i);
    }
  }
});

test('delivered SQL matches the current hardware/data scope', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/001_smartagri_supabase.sql'), 'utf8');
  for (const table of ['users', 'thresholds', 'pump_state', 'sensor_readings', 'irrigation_logs', 'notifications']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
  }
  assert.match(sql, /water_detected boolean not null/i);
  assert.match(sql, /actual_is_on boolean/i);
  assert.match(sql, /device_last_seen_at timestamptz/i);
  assert.doesNotMatch(sql, /temperature|solar|water_tank_level/i);
});
