import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="home">
      <header className="home-nav">
        <div className="home-nav-inner">
          <Link className="brand" to="/">
            <img src="/logo.png" alt="SmartAgri" />
            <div><div className="brand-name">SMARTAGRI</div><div className="brand-sub">FARM</div></div>
          </Link>
          <nav className="home-nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
            <Link to="/login">Login</Link>
            <Link className="primary-btn" to="/register">Get Started</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content">
            <div className="eyebrow">Smart irrigation monitoring</div>
            <h1>SMART MONITORING.<span>GREENER TOMORROW.</span></h1>
            <p>Monitor soil moisture, detect water availability, manage irrigation thresholds, and track every simulated pump action from one dark, focused dashboard.</p>
            <div className="hero-actions">
              <Link className="primary-btn" to="/register">Create Account</Link>
              <Link className="secondary-btn" to="/login">Open Dashboard</Link>
            </div>
            <div className="hero-note"><span>● Supabase database</span><span>● UI-first testing</span><span>● ESP32 integration comes later</span></div>
          </div>
        </div>
      </section>

      <section id="features" className="home-section">
        <div className="home-section-inner">
          <div className="eyebrow">Phase 1 + Phase 2</div>
          <h2 style={{ fontSize: 'clamp(2rem,5vw,3.4rem)', margin: '10px 0 0', letterSpacing: '-.04em' }}>Built around accurate data flow.</h2>
          <div className="feature-grid">
            <article className="feature-card"><div className="feature-icon">🌱</div><h3>Soil Monitoring</h3><p>View moisture percentage and raw sensor values with a history chart driven by Supabase records.</p></article>
            <article className="feature-card"><div className="feature-icon">💧</div><h3>Water Detection</h3><p>Track whether water is available and prevent pump activation when the test reading reports no water.</p></article>
            <article className="feature-card"><div className="feature-icon">⚙️</div><h3>Irrigation Control</h3><p>Test manual and automatic pump states, thresholds, logs, and notifications before connecting physical hardware.</p></article>
          </div>
        </div>
      </section>

      <section id="workflow" className="home-section" style={{ background: '#06170e' }}>
        <div className="home-section-inner">
          <div className="eyebrow">Testing workflow</div>
          <h2 style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', margin: '10px 0 18px', letterSpacing: '-.04em' }}>React → Express → Supabase</h2>
          <p style={{ color: '#9ab2a1', lineHeight: 1.7, maxWidth: 760 }}>During this stage, simulated sensor values are entered through the dashboard. The Express API validates them, stores them in Supabase, and the UI reads the same records back. No ESP32 or physical relay is connected yet.</p>
        </div>
      </section>

      <footer className="footer">SmartAgri Farm · UI and database integration test build</footer>
    </div>
  );
}
