import React, { useCallback, useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import API from '../api/axios';

const iconFor = (type) => ({ soil_low: '🌱', soil_normal: '✅', no_water: '⚠️', water_detected: '💧', pump_on: '⚙️', pump_off: '⏹️', system: '🔔' }[type] || '🔔');

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const response = await API.get('/notifications');
      setItems(Array.isArray(response.data) ? response.data : []);
      setError('');
      window.dispatchEvent(new Event('smartagri:notifications-updated'));
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load notifications. Check your connection and sign-in status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ quiet: true }), 5000);
    const onFocus = () => load({ quiet: true });
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  const mark = async (id) => {
    if (busyId !== null) return;
    setBusyId(id); setError('');
    try {
      await API.patch(`/notifications/${id}/read`);
      setItems((list) => list.map((n) => n.id === id ? { ...n, is_read: true } : n));
      window.dispatchEvent(new Event('smartagri:notifications-updated'));
    } catch (e) { setError(e.response?.data?.message || 'Could not mark this notification as read.'); }
    finally { setBusyId(null); }
  };

  const markAll = async () => {
    if (busyAll) return;
    setBusyAll(true); setError('');
    try {
      await API.patch('/notifications/read-all');
      setItems((list) => list.map((n) => ({ ...n, is_read: true })));
      window.dispatchEvent(new Event('smartagri:notifications-updated'));
    } catch (e) { setError(e.response?.data?.message || 'Could not mark notifications as read.'); }
    finally { setBusyAll(false); }
  };

  return (
    <div className="app-shell"><Navbar /><main className="page-wrap">
      <div className="page-heading"><div><div className="eyebrow">System activity</div><h1 className="page-title">Notifications</h1><p className="page-subtitle">Sensor alerts, water-safety events, and pump activity. This list refreshes automatically.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="secondary-btn" onClick={() => load({ quiet: true })} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button><button className="secondary-btn" onClick={markAll} disabled={busyAll || !items.some((n) => !n.is_read)}>{busyAll ? 'Updating…' : 'Mark all read'}</button></div></div>
      {error && <div className="banner error" role="alert">{error} <button className="secondary-btn" style={{ marginLeft: 8 }} onClick={() => load()} disabled={loading}>Retry</button></div>}
      <div className="notifications-list">{loading ? <div className="panel empty-state">Loading notifications…</div> : items.length === 0 ? <div className="panel empty-state">No notifications yet. New sensor or pump events will appear here.</div> : items.map((n) => <article key={n.id} className={`notification-card ${!n.is_read ? 'unread' : ''}`}><div className="notification-icon">{iconFor(n.type)}</div><div style={{ flex: 1, minWidth: 0 }}><h3 className="notification-title">{n.title || 'SmartAgri Notification'}</h3><p className="notification-message">{n.message}</p><span className="notification-time">{n.created_at ? new Date(n.created_at).toLocaleString() : 'Time unavailable'}</span></div><div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>{!n.is_read && <><span className="unread-dot" /><button className="secondary-btn" onClick={() => mark(n.id)} disabled={busyId !== null}>{busyId === n.id ? 'Saving…' : 'Mark read'}</button></>}</div></article>)}</div>
    </main><footer className="footer">SmartAgri Farm · Notifications from Supabase</footer></div>
  );
}
