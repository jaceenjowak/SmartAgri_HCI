const supabase = require('../config/supabase');

const fail = (res, err) => {
  console.error('Sensor database error:', err.message);
  return res.status(503).json({ message: 'Sensor data is unavailable. Check Supabase.' });
};

async function notification(userId, title, message, type) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    is_read: false,
  });
  if (error) throw error;
}

async function logAction(userId, action, triggerType, reading) {
  const { error } = await supabase.from('irrigation_logs').insert({
    user_id: userId,
    action,
    trigger_type: triggerType,
    moisture_at_trigger: reading ? Number(reading.moisture_percent) : null,
    water_detected: reading ? Boolean(reading.water_detected) : null,
  });
  if (error) throw error;
}

async function getPump(userId) {
  const { data, error } = await supabase.from('pump_state').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function setPump(userId, isOn, mode) {
  const { error } = await supabase.from('pump_state').update({ is_on: isOn, mode }).eq('user_id', userId);
  if (error) throw error;
}

async function simulateReading(req, res) {
  if (process.env.ENABLE_SIMULATION !== 'true') return res.status(403).json({ message: 'Simulation is disabled on this server.' });

  const { moisture_percent, soil_sensor_raw, water_detected } = req.body || {};
  const moisture = Number(moisture_percent);
  const raw = soil_sensor_raw === '' || soil_sensor_raw === undefined || soil_sensor_raw === null ? null : Number(soil_sensor_raw);

  if (!Number.isFinite(moisture) || moisture < 0 || moisture > 100 || typeof water_detected !== 'boolean' || (raw !== null && (!Number.isInteger(raw) || raw < 0 || raw > 4095))) {
    return res.status(400).json({ message: 'Enter moisture from 0–100, water detected true/false, and optional raw ADC from 0–4095.' });
  }

  try {
    const { data: reading, error: insertError } = await supabase
      .from('sensor_readings')
      .insert({
        user_id: req.user.id,
        moisture_percent: moisture,
        soil_sensor_raw: raw,
        water_detected,
        source: 'simulation',
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    const [{ data: thresholds, error: thresholdError }, pump] = await Promise.all([
      supabase.from('thresholds').select('*').eq('user_id', req.user.id).maybeSingle(),
      getPump(req.user.id),
    ]);
    if (thresholdError) throw thresholdError;
    if (!thresholds || !pump) throw new Error('Default threshold or pump-state row is missing for this account.');

    let pumpOn = Boolean(pump.is_on);
    let action = null;

    if (!water_detected && pumpOn) {
      await setPump(req.user.id, false, 'auto');
      await logAction(req.user.id, 'off', 'safety', reading);
      await notification(req.user.id, 'Pump Safety Stop', 'No water was detected. The simulated pump was switched OFF for safety.', 'no_water');
      pumpOn = false;
      action = 'off';
    } else if (!water_detected) {
      await notification(req.user.id, 'No Water Detected', 'Water is unavailable. Pump ON is blocked until water is detected.', 'no_water');
    } else if (thresholds.auto_irrigation && moisture < Number(thresholds.dry_threshold) && !pumpOn) {
      await setPump(req.user.id, true, 'auto');
      await logAction(req.user.id, 'on', 'auto', reading);
      await notification(req.user.id, 'Dry Soil Detected', `Soil moisture is ${moisture}%. Simulated auto-irrigation switched ON.`, 'soil_low');
      pumpOn = true;
      action = 'on';
    } else if (thresholds.auto_irrigation && moisture >= Number(thresholds.wet_threshold) && pumpOn) {
      await setPump(req.user.id, false, 'auto');
      await logAction(req.user.id, 'off', 'auto', reading);
      await notification(req.user.id, 'Moisture Target Reached', `Soil moisture reached ${moisture}%. Simulated auto-irrigation switched OFF.`, 'soil_normal');
      pumpOn = false;
      action = 'off';
    }

    return res.status(201).json({
      message: 'Simulated reading saved to Supabase.',
      reading,
      pump_on: pumpOn,
      action,
      simulation: true,
    });
  } catch (err) {
    return fail(res, err);
  }
}

async function getLatest(req, res) {
  try {
    const [readingResult, pumpResult] = await Promise.all([
      supabase.from('sensor_readings').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('pump_state').select('is_on,actual_is_on,mode,updated_at,device_last_seen_at').eq('user_id', req.user.id).maybeSingle(),
    ]);
    if (readingResult.error) throw readingResult.error;
    if (pumpResult.error) throw pumpResult.error;
    const simulation = process.env.ENABLE_SIMULATION === 'true';
    const lastSeen = pumpResult.data?.device_last_seen_at ? new Date(pumpResult.data.device_last_seen_at).getTime() : 0;
    const deviceOnline = !simulation && Boolean(lastSeen) && Date.now() - lastSeen <= Math.max(10000, Number(process.env.IOT_SENSOR_MAX_AGE_MS) || 30000);
    return res.json({
      reading: readingResult.data || null,
      pump_on: simulation ? Boolean(pumpResult.data?.is_on) : Boolean(pumpResult.data?.actual_is_on),
      desired_pump_on: Boolean(pumpResult.data?.is_on),
      device_online: simulation ? null : deviceOnline,
      pump_mode: pumpResult.data?.mode || 'manual',
      pump_updated_at: pumpResult.data?.updated_at || null,
      simulation,
    });
  } catch (err) {
    return fail(res, err);
  }
}

async function getHistory(req, res) {
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ message: 'Limit must be between 1 and 100.' });
  try {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return res.json((data || []).reverse());
  } catch (err) {
    return fail(res, err);
  }
}

async function getAllReadings(req, res) {
  try {
    const { data, error } = await supabase.from('sensor_readings').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    return fail(res, err);
  }
}

function postReading(req, res) {
  return res.status(410).json({ message: 'This user-authenticated ingestion endpoint is retired. ESP32 devices must use POST /api/iot/reading with X-Device-Id and X-Device-Key headers. Use POST /api/sensor/simulate for test data.' });
}

module.exports = { simulateReading, postReading, getLatest, getHistory, getAllReadings };
