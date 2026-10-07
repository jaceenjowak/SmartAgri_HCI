export default function SensorCard({ title, value, unit = '', icon, subtitle, accent = '#36d56b' }) {
  return (
    <article className="sensor-card" style={{ '--accent': accent }}>
      <div className="sensor-top"><div className="sensor-title">{title}</div><div className="sensor-icon">{icon}</div></div>
      <div>
        <div className="sensor-value">{value === null || value === undefined || value === '' ? '—' : value}<span className="sensor-unit">{unit}</span></div>
        {subtitle && <div className="sensor-subtitle">{subtitle}</div>}
      </div>
    </article>
  );
}
