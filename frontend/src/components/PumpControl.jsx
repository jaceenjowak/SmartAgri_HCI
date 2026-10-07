import React, { useState } from 'react';
import API from '../api/axios';

export default function PumpControl({ pumpOn, desiredPumpOn = pumpOn, pumpMode, onChanged, simulation = true, deviceOnline = false, canTurnOn = true }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const commandState = simulation ? pumpOn : desiredPumpOn;
  const toggle = async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const r = await API.post('/irrigation/control', { action: commandState ? 'off' : 'on' });
      onChanged(Boolean(r.data.pump_on), Boolean(r.data.simulation));
      setNotice(r.data.message || 'Pump command updated.');
    } catch (e) { setError(e.response?.data?.message || 'Failed to update pump state.'); }
    finally { setLoading(false); }
  };
  return (
    <section className="panel panel-pad">
      <h3 className="panel-title">Manual Pump Control</h3>
      <p className="panel-copy">{simulation ? 'Simulation only: this changes the database state and does not operate a physical relay.' : 'Commands are sent to the ESP32. The physical relay is controlled by the device and may take a few seconds to confirm.'}</p>
      <div className="pump-status-row">
        <div><div className="eyebrow">{simulation ? 'Simulated state' : 'Reported physical state'}</div><div style={{ marginTop: 5, fontWeight: 900 }}>Mode: {pumpMode || 'manual'}</div>{!simulation && <div className="hint">ESP32: {deviceOnline ? 'Online' : 'Offline'} · Desired: {desiredPumpOn ? 'ON' : 'OFF'}</div>}</div>
        <span className={`status-pill ${pumpOn ? 'on' : 'off'}`}>● {pumpOn ? 'ON' : 'OFF'}</span>
      </div>
      <button className={`primary-btn full-btn ${commandState ? 'danger-btn' : ''}`} disabled={loading || (!commandState && !simulation && !canTurnOn)} onClick={toggle}>{loading ? 'Updating...' : commandState ? 'Turn Pump OFF' : 'Turn Pump ON'}</button>
      {!simulation && !deviceOnline && <div className="message error">ESP32 is offline. Pump ON is disabled until fresh sensor data arrives. OFF commands can still be queued.</div>}
      {notice && <div className="message ok">{notice}</div>}
      {error && <div className="message error">{error}</div>}
      <p className="hint" style={{ marginTop: 16 }}>Pump ON is blocked when the latest water sensor state is “No water”. {simulation ? 'Simulation mode is active.' : 'If the ESP32 is offline, its local fail-safe should force the relay OFF.'}</p>
    </section>
  );
}
