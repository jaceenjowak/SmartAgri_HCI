const supabase = require('../config/supabase');

const fail = (res, err) => {
  console.error('Notification database error:', err.message);
  return res.status(503).json({ message: 'Notifications are unavailable. Check Supabase.' });
};

async function getNotifications(req, res) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50);
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    return fail(res, err);
  }
}

async function markRead(req, res) {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ message: 'Invalid notification ID.' });
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Notification not found.' });
    return res.json({ message: 'Marked as read.' });
  } catch (err) {
    return fail(res, err);
  }
}

async function markAllRead(req, res) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);
    if (error) throw error;
    return res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    return fail(res, err);
  }
}

async function getUnreadCount(req, res) {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);
    if (error) throw error;
    return res.json({ count: count || 0 });
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = { getNotifications, markRead, markAllRead, getUnreadCount };
