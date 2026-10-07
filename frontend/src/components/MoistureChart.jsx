import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export default function MoistureChart({ data }) {
  const chartData = {
    labels: data.map((d) => new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [{
      label: 'Soil moisture (%)',
      data: data.map((d) => Number(d.moisture_percent)),
      borderColor: '#58e982',
      backgroundColor: 'rgba(54,213,107,.10)',
      pointBackgroundColor: '#7cf29b',
      pointBorderColor: '#0a1e13',
      pointRadius: 3,
      borderWidth: 2,
      tension: .35,
      fill: true,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9ab2a1', usePointStyle: true, boxWidth: 8 } }, tooltip: { backgroundColor: '#071a10', titleColor: '#fff', bodyColor: '#bcd0c2', borderColor: '#29593a', borderWidth: 1 } },
    scales: {
      x: { ticks: { color: '#789382', maxRotation: 0 }, grid: { color: 'rgba(124,242,155,.05)' }, border: { color: 'rgba(124,242,155,.08)' } },
      y: { min: 0, max: 100, ticks: { color: '#789382' }, grid: { color: 'rgba(124,242,155,.07)' }, border: { color: 'rgba(124,242,155,.08)' } },
    },
  };
  return (
    <section className="panel panel-pad chart-panel">
      <div><h3 className="panel-title">Soil Moisture Trend</h3><p className="panel-copy">Latest readings stored in Supabase.</p></div>
      <div className="chart-area">{data.length ? <Line data={chartData} options={options} /> : <div className="empty-state">No sensor readings yet. Add a simulated reading below.</div>}</div>
    </section>
  );
}
