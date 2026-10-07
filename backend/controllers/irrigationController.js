const supabase = require('../config/supabase');

const fail = (res, err) => {
  console.error('Irrigation database error:', err.message);
  return res.status(503).json({ message: 'Irrigation data is unavailable. Check Supabase.' });
};

async function getLatestReading(userId) {
  const { data, error } = await supabase.from('sensor_readings').select('*').eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function createNotification(userId, title, message, type) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, title, message, type, is_read: false });
  if (error) throw error;
}

async function controlPump(req, res) {
  const { action } = req.body || {};
  if (!['on', 'off'].includes(action)) return res.status(400).json({ message: 'Action must be "on" or "off".' });
  const hardwareMode = process.env.ENABLE_SIMULATION !== 'true';
  try {
    const wanted = action === 'on';
    const latest = await getLatestReading(req.user.id);
    if (wanted && !latest) return res.status(400).json({ message: 'No sensor reading is available. Wait for the ESP32 to send a reading before turning the pump ON.' });
    if (wanted && hardwareMode && (!latest.created_at || Date.now() - new Date(latest.created_at).getTime() > Math.max(10000, Number(process.env.IOT_SENSOR_MAX_AGE_MS) || 30000))) return res.status(409).json({ message: 'The ESP32 sensor reading is stale. Check the device connection before turning the pump ON.' });
    if (wanted && !latest.water_detected) return res.status(400).json({ message: 'Pump ON blocked because the latest water sensor reading reports no water.' });

    const { data: current, error: currentError } = await supabase.from('pump_state').select('*').eq('user_id', req.user.id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return res.status(404).json({ message: 'Pump state row not found for this account. Check the database defaults/migration.' });

    if (Boolean(current.is_on) !== wanted || current.mode !== 'manual') {
      const { data: updated, error: updateError } = await supabase.from('pump_state').update({ is_on: wanted, ...(hardwareMode ? {} : { actual_is_on: wanted }), mode: 'manual' }).eq('user_id', req.user.id).select('*').maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error('Pump state could not be updated.');
      if (Boolean(current.is_on) !== wanted) {
        const { error: logError } = await supabase.from('irrigation_logs').insert({ user_id: req.user.id, action, trigger_type: 'manual', moisture_at_trigger: latest ? Number(latest.moisture_percent) : null, water_detected: latest ? Boolean(latest.water_detected) : null });
        if (logError) throw logError;
        await createNotification(req.user.id, wanted ? 'Pump Commanded ON' : 'Pump Commanded OFF', hardwareMode ? `Manual command sent to the ESP32: pump ${wanted ? 'ON' : 'OFF'}. Waiting for device confirmation.` : `Simulation: pump manually switched ${wanted ? 'ON' : 'OFF'}.`, wanted ? 'pump_on' : 'pump_off');
      }
    }
    return res.json({ message: hardwareMode ? `Pump ${wanted ? 'ON' : 'OFF'} command queued for the ESP32.` : `Simulated pump is ${wanted ? 'ON' : 'OFF'}.`, pump_on: wanted, simulation: !hardwareMode, command_pending: hardwareMode });
  } catch (err) {
    return fail(res, err);
  }
}

async function getLogs(req, res) {
  const limit = Number(req.query.limit || 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ message: 'Limit must be between 1 and 100.' });
  try {
    const { data, error } = await supabase.from('irrigation_logs').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
    if (error) throw error;
    return res.json(data || []);
  } catch (err) { return fail(res, err); }
}

async function getPumpStatus(req, res) {
  try {
    const [{ data, error }, latest] = await Promise.all([
      supabase.from('pump_state').select('is_on,actual_is_on,mode,updated_at,device_last_seen_at').eq('user_id', req.user.id).maybeSingle(),
      getLatestReading(req.user.id),
    ]);
    if (error) throw error;
    const simulation = process.env.ENABLE_SIMULATION === 'true';
    const maxAgeMs = Math.max(10000, Number(process.env.IOT_SENSOR_MAX_AGE_MS) || 30000);
    const lastSeen = data?.device_last_seen_at ? new Date(data.device_last_seen_at).getTime() : 0;
    const deviceOnline = !simulation && Boolean(lastSeen) && Date.now() - lastSeen <= maxAgeMs;
    return res.json({ is_on: simulation ? Boolean(data?.is_on) : Boolean(data?.actual_is_on), desired_is_on: Boolean(data?.is_on), mode: data?.mode || 'manual', updated_at: data?.updated_at || null, simulation, device_online: simulation ? null : deviceOnline, device_last_seen_at: data?.device_last_seen_at || null, last_sensor_at: latest?.created_at || null, sensor_source: latest?.source || null });
  } catch (err) { return fail(res, err); }
}

module.exports = { controlPump, getLogs, getPumpStatus };
