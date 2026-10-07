import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import API from '../api/axios';

export default function IrrigationLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { API.get('/irrigation/logs?limit=100').then((r) => setLogs(r.data || [])).catch((e) => setError(e.response?.data?.message || 'Could not load logs.')).finally(() => setLoading(false)); }, []);
  return (
    <div className="app-shell"><Navbar /><main className="page-wrap">
      <div className="page-heading"><div><div className="eyebrow">Audit trail</div><h1 className="page-title">Irrigation Logs</h1><p className="page-subtitle">Every simulated manual, automatic, or safety pump action stored for the current account.</p></div></div>
      {error && <div className="banner error">{error}</div>}
      <section className="panel panel-pad">
        {loading ? <div className="empty-state">Loading logs...</div> : logs.length === 0 ? <div className="empty-state">No irrigation activity yet.</div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Date / Time</th><th>Action</th><th>Trigger</th><th>Moisture</th><th>Water</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString()}</td><td><span className={`status-pill ${log.action === 'on' ? 'on' : 'off'}`}>{String(log.action).toUpperCase()}</span></td><td>{log.trigger_type}</td><td>{log.moisture_at_trigger == null ? '—' : `${Number(log.moisture_at_trigger).toFixed(1)}%`}</td><td>{log.water_detected == null ? '—' : log.water_detected ? 'Detected' : 'No water'}</td></tr>)}</tbody></table></div>}
      </section>
    </main><footer className="footer">SmartAgri Farm · Irrigation history from Supabase</footer></div>
  );
}
