const supabase = require('../config/supabase');

const fail = (res, err) => {
  console.error('IoT request failed:', err?.message || err);
  return res.status(503).json({ message: 'IoT request could not be completed. Check Supabase and the device configuration.' });
};

async function createNotification(userId, title, message, type) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, title, message, type, is_read: false });
  if (error) throw error;
}

async function addLog(userId, action, triggerType, reading) {
  const { error } = await supabase.from('irrigation_logs').insert({
    user_id: userId,
    action,
    trigger_type: triggerType,
    moisture_at_trigger: reading ? Number(reading.moisture_percent) : null,
    water_detected: reading ? Boolean(reading.water_detected) : null,
  });
  if (error) throw error;
}

async function setPump(userId, isOn, mode) {
  const { data, error } = await supabase.from('pump_state').update({ is_on: isOn, mode }).eq('user_id', userId).select('is_on,mode,updated_at').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Pump state row is missing for the configured IoT user.');
  return data;
}

async function postReading(req, res) {
  const { moisture_percent, soil_sensor_raw, water_detected } = req.body || {};
  const moisture = Number(moisture_percent);
  const raw = soil_sensor_raw === '' || soil_sensor_raw === undefined || soil_sensor_raw === null ? null : Number(soil_sensor_raw);
  if (!Number.isFinite(moisture) || moisture < 0 || moisture > 100 || typeof water_detected !== 'boolean' || (raw !== null && (!Number.isInteger(raw) || raw < 0 || raw > 4095))) {
    return res.status(400).json({ message: 'Invalid sensor reading. Moisture must be 0–100, water_detected must be boolean, and ADC must be 0–4095.' });
  }
  try {
    const userId = req.deviceUserId;
    const { data: previous, error: previousError } = await supabase.from('sensor_readings').select('water_detected').eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
    if (previousError) throw previousError;
    const { data: reading, error: readingError } = await supabase.from('sensor_readings').insert({
      user_id: userId,
      moisture_percent: moisture,
      soil_sensor_raw: raw,
      water_detected,
      source: 'esp32',
    }).select('*').single();
    if (readingError) throw readingError;

    const [{ data: thresholds, error: thresholdError }, { data: pump, error: pumpError }] = await Promise.all([
      supabase.from('thresholds').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('pump_state').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (thresholdError) throw thresholdError;
    if (pumpError) throw pumpError;
    if (!thresholds || !pump) throw new Error('Default thresholds or pump-state row missing. Register the account again or apply the database migration/default rows.');
    const { error: heartbeatError } = await supabase.from('pump_state').update({ device_last_seen_at: new Date().toISOString(), device_online: true }).eq('user_id', userId);
    if (heartbeatError) throw heartbeatError;

    let pumpOn = Boolean(pump.is_on);
    let action = null;
    if (previous && previous.water_detected === false && water_detected === true) {
      await createNotification(userId, 'Water Supply Restored', 'The ESP32 reports that water is detected again.', 'water_detected');
    }
    if (!water_detected && pumpOn) {
      await setPump(userId, false, 'auto');
      await addLog(userId, 'off', 'safety', reading);
      await createNotification(userId, 'Pump Safety Stop', 'The ESP32 reports no water. The desired pump state was switched OFF for safety.', 'no_water');
      pumpOn = false;
      action = 'off';
    } else if (!water_detected) {
      // Avoid creating a notification every 5 seconds: only notify when no unread
      // no-water alert already exists for this user.
      const { data: activeAlert, error: alertError } = await supabase.from('notifications').select('id').eq('user_id', userId).eq('type', 'no_water').gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(1).maybeSingle();
      if (alertError) throw alertError;
      if (!activeAlert) await createNotification(userId, 'No Water Detected', 'The ESP32 reports no water. Pump ON commands are blocked until water is detected.', 'no_water');
    } else if (thresholds.auto_irrigation && moisture < Number(thresholds.dry_threshold) && !pumpOn) {
      await setPump(userId, true, 'auto');
      await addLog(userId, 'on', 'auto', reading);
      await createNotification(userId, 'Dry Soil Detected', `Soil moisture is ${moisture.toFixed(1)}%. Automatic irrigation requested the pump ON.`, 'soil_low');
      pumpOn = true;
      action = 'on';
    } else if (thresholds.auto_irrigation && moisture >= Number(thresholds.wet_threshold) && pumpOn) {
      await setPump(userId, false, 'auto');
      await addLog(userId, 'off', 'auto', reading);
      await createNotification(userId, 'Moisture Target Reached', `Soil moisture reached ${moisture.toFixed(1)}%. Automatic irrigation requested the pump OFF.`, 'soil_normal');
      pumpOn = false;
      action = 'off';
    }
    return res.status(201).json({ message: 'ESP32 sensor reading saved.', reading, pump_on: pumpOn, action, simulation: false });
  } catch (err) {
    return fail(res, err);
  }
}

async function getPumpCommand(req, res) {
  try {
    const { data, error } = await supabase.from('pump_state').select('is_on,mode,updated_at,device_last_seen_at').eq('user_id', req.deviceUserId).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Pump state is not initialized for this account.' });
    const maxAgeMs = Math.max(10000, Number(process.env.IOT_SENSOR_MAX_AGE_MS) || 30000);
    const lastSeen = data.device_last_seen_at ? new Date(data.device_last_seen_at).getTime() : 0;
    if (Boolean(data.is_on) && (!lastSeen || Date.now() - lastSeen > maxAgeMs)) {
      const { error: stopError } = await supabase.from('pump_state').update({ is_on: false, mode: 'auto', actual_is_on: false, device_online: false }).eq('user_id', req.deviceUserId);
      if (stopError) throw stopError;
      await addLog(req.deviceUserId, 'off', 'safety', null);
      await createNotification(req.deviceUserId, 'Device Safety Stop', 'The ESP32 sensor heartbeat is stale. The desired pump state was set to OFF.', 'no_water');
      return res.set('Cache-Control', 'no-store').json({ pump_on: false, mode: 'auto', updated_at: new Date().toISOString(), simulation: false, safety_stop: 'stale_sensor' });
    }
    return res.set('Cache-Control', 'no-store').json({ pump_on: Boolean(data.is_on), mode: data.mode, updated_at: data.updated_at, simulation: false });
  } catch (err) {
    return fail(res, err);
  }
}

async function postPumpStatus(req, res) {
  const { pump_on, water_detected } = req.body || {};
  if (typeof pump_on !== 'boolean' || typeof water_detected !== 'boolean') {
    return res.status(400).json({ message: 'pump_on and water_detected must both be boolean values.' });
  }
  try {
    const userId = req.deviceUserId;
    const { data: current, error: currentError } = await supabase.from('pump_state').select('is_on,actual_is_on,mode').eq('user_id', userId).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return res.status(404).json({ message: 'Pump state is not initialized for this account.' });

    // Physical status is authoritative. No-water status can never persist ON.
    const actualOn = pump_on && water_detected;
    const { error: heartbeatError } = await supabase.from('pump_state').update({ device_last_seen_at: new Date().toISOString(), device_online: true }).eq('user_id', userId);
    if (heartbeatError) throw heartbeatError;
    if (Boolean(current.actual_is_on) !== actualOn) {
      const { error: updateError } = await supabase.from('pump_state').update({ actual_is_on: actualOn, device_last_seen_at: new Date().toISOString(), device_online: true, mode: current.mode || 'manual' }).eq('user_id', userId);
      if (updateError) throw updateError;
      await addLog(userId, actualOn ? 'on' : 'off', water_detected ? 'manual' : 'safety', null);
      await createNotification(userId, actualOn ? 'Pump Turned On' : 'Pump Turned Off', water_detected ? `ESP32 reported the physical pump ${actualOn ? 'ON' : 'OFF'}.` : 'ESP32 safety report: no water detected; physical pump is OFF.', actualOn ? 'pump_on' : (water_detected ? 'pump_off' : 'no_water'));
    }
    if (!water_detected && (pump_on || Boolean(current.is_on))) {
      await setPump(userId, false, 'auto');
    }
    return res.json({ message: 'Physical pump status recorded.', pump_on: actualOn, water_detected, simulation: false });
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = { postReading, getPumpCommand, postPumpStatus };
