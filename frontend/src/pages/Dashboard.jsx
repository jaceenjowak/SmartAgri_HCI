import React, { useCallback, useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import SensorCard from '../components/SensorCard';
import MoistureChart from '../components/MoistureChart';
import PumpControl from '../components/PumpControl';
import API from '../api/axios';

export default function Dashboard() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [pumpOn, setPumpOn] = useState(false);
  const [desiredPumpOn, setDesiredPumpOn] = useState(false);
  const [pumpMode, setPumpMode] = useState('manual');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [saving, setSaving] = useState(false);
  const [simMessage, setSimMessage] = useState('');
  const [simulation, setSimulation] = useState({ moisture_percent: 42, soil_sensor_raw: '', water_detected: true });
  const [hardwareMode, setHardwareMode] = useState(false);
  const [iotConfigured, setIotConfigured] = useState(false);
  const [deviceOnline, setDeviceOnline] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [latestRes, historyRes, thresholdRes, healthRes] = await Promise.all([
        API.get('/sensor/latest'),
        API.get('/sensor/history?limit=20'),
        API.get('/thresholds'),
        API.get('/health'),
      ]);
      setHardwareMode(healthRes.data?.mode === 'hardware' || healthRes.data?.simulation === false);
      setIotConfigured(Boolean(healthRes.data?.iot_configured));
      setLatest(latestRes.data.reading);
      setPumpOn(Boolean(latestRes.data.pump_on));
      setDesiredPumpOn(Boolean(latestRes.data.desired_pump_on ?? latestRes.data.pump_on));
      setPumpMode(latestRes.data.pump_mode || 'manual');
      setDeviceOnline(Boolean(latestRes.data.device_online));
      setHistory(historyRes.data || []);
      setThresholds(thresholdRes.data);
      setError('');
      setLastSync(new Date());
    } catch (e) { setError(e.response?.data?.message || 'Could not synchronize with the backend/Supabase.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, hardwareMode ? 3000 : 15000);
    return () => clearInterval(timer);
  }, [fetchData, hardwareMode]);

  const saveSimulation = async (e) => {
    e.preventDefault(); setSaving(true); setSimMessage('');
    try {
      const r = await API.post('/sensor/simulate', {
        moisture_percent: Number(simulation.moisture_percent),
        soil_sensor_raw: simulation.soil_sensor_raw === '' ? null : Number(simulation.soil_sensor_raw),
        water_detected: simulation.water_detected,
      });
      setSimMessage(`Reading #${r.data.reading.id} saved. Pump state: ${r.data.pump_on ? 'ON' : 'OFF'}.`);
      await fetchData();
    } catch (e) { setSimMessage(e.response?.data?.message || 'Could not save the simulated reading.'); }
    finally { setSaving(false); }
  };

  const moisture = latest ? Number(latest.moisture_percent) : null;
  const moistureStatus = moisture == null ? 'No readings yet' : !thresholds ? 'Waiting for thresholds' : moisture < Number(thresholds.dry_threshold) ? 'Dry · below threshold' : moisture >= Number(thresholds.wet_threshold) ? 'Wet threshold reached' : 'Within configured range';

  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-wrap">
        <div className="page-heading"><div><div className="eyebrow">Live test workspace</div><h1 className="page-title">Farm Dashboard</h1><p className="page-subtitle">Dark UI connected through Express to the SmartAgri Supabase database. Data refreshes every 15 seconds.</p></div>{lastSync && <span className="status-pill on">● Synced {lastSync.toLocaleTimeString()}</span>}</div>
        <div className="banner sim"><strong>{hardwareMode ? 'Hardware mode:' : 'Simulation mode:'}</strong> {hardwareMode ? (iotConfigured ? 'Real ESP32 readings and pump commands are enabled. Verify the device is online before operating the relay.' : 'Hardware mode is selected, but IoT credentials/owner are not fully configured on the backend.') : 'Readings and pump states are database tests only; physical hardware is not controlled in this mode.'}</div>
        {error && <div className="banner error">⚠ {error} <button className="secondary-btn" style={{ marginLeft: 8 }} onClick={fetchData}>Retry</button></div>}

        <section className="grid stats-grid">
          <SensorCard title="Soil Moisture" value={moisture == null ? null : moisture.toFixed(1)} unit="%" icon="🌱" subtitle={moistureStatus} />
          <SensorCard title="Water Sensor" value={latest ? (latest.water_detected ? 'DETECTED' : 'NO WATER') : null} icon="💧" subtitle="Boolean water-availability reading" accent="#69b7ff" />
          <SensorCard title="Pump Status" value={pumpOn ? 'ON' : 'OFF'} icon="⚙️" subtitle={hardwareMode ? `Mode: ${pumpMode} · ESP32 ${deviceOnline ? 'online' : 'offline'}` : `Mode: ${pumpMode} · simulated`} accent={pumpOn ? '#36d56b' : '#ff6b6b'} />
          <SensorCard title="Raw ADC" value={latest?.soil_sensor_raw ?? null} icon="📟" subtitle="Optional soil sensor raw value (0–4095)" accent="#f4c95d" />
        </section>

        <section className="grid dashboard-main">
          <MoistureChart data={history} />
          <PumpControl pumpOn={pumpOn} desiredPumpOn={desiredPumpOn} pumpMode={pumpMode} simulation={!hardwareMode} deviceOnline={deviceOnline} canTurnOn={iotConfigured && deviceOnline} onChanged={(value) => { setDesiredPumpOn(value); if (!hardwareMode) setPumpOn(value); setPumpMode('manual'); fetchData(); }} />
        </section>

        {!hardwareMode && <section className="panel panel-pad" style={{ marginTop: 18 }}>
          <div className="eyebrow">Database connection test</div><h3 className="panel-title" style={{ marginTop: 6 }}>Add a simulated sensor reading</h3><p className="panel-copy">This verifies UI → Express → Supabase → UI before we connect the ESP32.</p>
          <form className="form-grid" onSubmit={saveSimulation}>
            <div className="field"><label>Soil moisture (%)</label><input className="input" type="number" min="0" max="100" step="0.1" required value={simulation.moisture_percent} onChange={(e) => setSimulation({ ...simulation, moisture_percent: e.target.value })} /></div>
            <div className="field"><label>Raw ADC (optional)</label><input className="input" type="number" min="0" max="4095" value={simulation.soil_sensor_raw} onChange={(e) => setSimulation({ ...simulation, soil_sensor_raw: e.target.value })} /></div>
            <div>
              <label className="field-label">Water availability</label>
              <label className="checkbox-row"><input type="checkbox" checked={simulation.water_detected} onChange={(e) => setSimulation({ ...simulation, water_detected: e.target.checked })} /> Water detected</label>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><button className="primary-btn" disabled={saving || Boolean(error)}>{saving ? 'Saving...' : 'Save Simulated Reading'}</button>{thresholds && <span className="hint">Dry below {thresholds.dry_threshold}% · Wet at {thresholds.wet_threshold}% · Auto {thresholds.auto_irrigation ? 'ON' : 'OFF'}</span>}</div>
          </form>
          {simMessage && <div className={`message ${simMessage.startsWith('Reading') ? 'ok' : 'error'}`}>{simMessage}</div>}
        </section>}

        <p className="hint" style={{ textAlign: 'right', marginTop: 16 }}>{loading ? 'Loading...' : latest ? `Latest database reading: ${new Date(latest.created_at).toLocaleString()} · Source: ${latest.source}` : 'No sensor data stored for this account yet.'}</p>
      </main>
      <footer className="footer">SmartAgri Farm · Supabase-backed {hardwareMode ? 'ESP32 hardware mode' : 'simulation mode'}</footer>
    </div>
  );
}
