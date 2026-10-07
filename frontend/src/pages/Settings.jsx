import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import API from '../api/axios';

export default function Settings() {
  const [form, setForm] = useState({ dry_threshold: 30, wet_threshold: 70, auto_irrigation: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { API.get('/thresholds').then((r) => setForm({ dry_threshold: Number(r.data.dry_threshold), wet_threshold: Number(r.data.wet_threshold), auto_irrigation: Boolean(r.data.auto_irrigation) })).catch((e) => setMessage(e.response?.data?.message || 'Could not load thresholds.')).finally(() => setLoading(false)); }, []);
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setMessage('');
    try { const r = await API.put('/thresholds', form); setForm({ dry_threshold: Number(r.data.dry_threshold), wet_threshold: Number(r.data.wet_threshold), auto_irrigation: Boolean(r.data.auto_irrigation) }); setMessage('Settings saved to Supabase.'); }
    catch (e) { setMessage(e.response?.data?.message || 'Could not save settings.'); }
    finally { setSaving(false); }
  };
  return (
    <div className="app-shell"><Navbar /><main className="page-wrap">
      <div className="page-heading"><div><div className="eyebrow">Automation rules</div><h1 className="page-title">Settings</h1><p className="page-subtitle">Configure the moisture thresholds used by simulated automatic irrigation decisions.</p></div></div>
      <section className="panel panel-pad settings-card">
        {loading ? <div className="empty-state">Loading settings...</div> : <form onSubmit={save}>
          <div className="settings-row"><div className="field"><label>Dry threshold (%)</label><input className="input" type="number" min="0" max="100" step="0.1" value={form.dry_threshold} onChange={(e) => setForm({ ...form, dry_threshold: Number(e.target.value) })} /></div><div className="field"><label>Wet threshold (%)</label><input className="input" type="number" min="0" max="100" step="0.1" value={form.wet_threshold} onChange={(e) => setForm({ ...form, wet_threshold: Number(e.target.value) })} /></div></div>
          <div className="toggle-box"><div><strong>Automatic irrigation</strong><div className="hint" style={{ marginTop: 4 }}>Use simulated readings to automatically update the database pump state.</div></div><label className="checkbox-row"><input type="checkbox" checked={form.auto_irrigation} onChange={(e) => setForm({ ...form, auto_irrigation: e.target.checked })} /> {form.auto_irrigation ? 'Enabled' : 'Disabled'}</label></div>
          {message && <div className={`message ${message.startsWith('Settings') ? 'ok' : 'error'}`}>{message}</div>}
          <button className="primary-btn" style={{ marginTop: 18 }} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </form>}
      </section>
    </main><footer className="footer">SmartAgri Farm · Threshold configuration stored in Supabase</footer></div>
  );
}
