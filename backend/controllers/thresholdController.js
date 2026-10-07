const supabase = require('../config/supabase');

async function getThresholds(req, res) {
  try {
    const { data, error } = await supabase.from('thresholds').select('*').eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Threshold settings were not found for this account.' });
    return res.json(data);
  } catch (err) {
    console.error('Threshold read error:', err.message);
    return res.status(503).json({ message: 'Cannot load thresholds from Supabase.' });
  }
}

async function updateThresholds(req, res) {
  const { dry_threshold, wet_threshold, auto_irrigation } = req.body || {};
  const dry = Number(dry_threshold);
  const wet = Number(wet_threshold);

  if (!Number.isFinite(dry) || !Number.isFinite(wet) || dry < 0 || dry > 100 || wet < 0 || wet > 100 || dry >= wet || typeof auto_irrigation !== 'boolean') {
    return res.status(400).json({ message: 'Thresholds must be 0–100, dry must be below wet, and auto-irrigation must be true or false.' });
  }

  try {
    const { data, error } = await supabase
      .from('thresholds')
      .update({ dry_threshold: dry, wet_threshold: wet, auto_irrigation })
      .eq('user_id', req.user.id)
      .select('*')
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('Threshold update error:', err.message);
    return res.status(503).json({ message: 'Cannot save thresholds to Supabase.' });
  }
}

module.exports = { getThresholds, updateThresholds };
