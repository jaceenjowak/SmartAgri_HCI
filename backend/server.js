require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./config/supabase');
const { getJwtSecret } = require('./config/jwt');

getJwtSecret();
const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((v) => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin is not allowed by CORS.'));
} }));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));

app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    const simulation = process.env.ENABLE_SIMULATION === 'true';
    return res.json({ status: 'ok', database: 'supabase', phase: simulation ? 'simulation' : 'hardware', mode: simulation ? 'simulation' : 'hardware', simulation, iot_configured: Boolean(process.env.IOT_DEVICE_ID && process.env.IOT_DEVICE_KEY && Number(process.env.IOT_USER_ID) > 0), timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Database health error:', err.message);
    return res.status(503).json({ status: 'database_unavailable', message: 'Check SUPABASE_URL, SUPABASE_SECRET_KEY, and the database schema.' });
  }
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/sensor', require('./routes/sensorRoutes'));
app.use('/api/irrigation', require('./routes/irrigationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/thresholds', require('./routes/thresholdRoutes'));
app.use('/api/iot', require('./routes/iotroutes'));

app.use((req, res) => res.status(404).json({ message: 'Route not found', path: req.originalUrl, method: req.method }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.message === 'Origin is not allowed by CORS.') return res.status(403).json({ message: err.message });
  console.error('Unhandled API error:', err?.message || err);
  return res.status(500).json({ message: 'Unexpected server error.' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 5000);
  app.listen(port, '0.0.0.0', () => console.log(`SmartAgri API ready on http://0.0.0.0:${port} (${process.env.ENABLE_SIMULATION === 'true' ? 'simulation' : 'hardware'} mode)`));
}
module.exports = app;
