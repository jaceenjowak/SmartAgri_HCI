import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await login(form); navigate('/dashboard'); }
    catch (err) { setError(err.response?.data?.message || 'Cannot reach the backend. Check that the API is running.'); }
    finally { setLoading(false); }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <section className="auth-visual">
          <Link className="brand" to="/"><img src="/logo.png" alt="SmartAgri" /><div><div className="brand-name">SMARTAGRI</div><div className="brand-sub">FARM</div></div></Link>
          <div className="auth-tagline"><div className="eyebrow">Welcome back</div><h2>Monitor smarter. Irrigate with confidence.</h2><p>Your dashboard reads current SmartAgri data through the Express API and Supabase.</p></div>
        </section>
        <section className="auth-form-side">
          <div className="eyebrow">Account access</div><h1>Sign in</h1><p>Use the account you created in SmartAgri.</p>
          <form className="auth-form" onSubmit={submit}>
            <div className="field"><label>Username</label><input className="input" autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
            <div className="field"><label>Password</label><input className="input" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            {error && <div className="message error">{error}</div>}
            <button className="primary-btn full-btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
          </form>
          <div className="auth-meta">No account yet? <Link to="/register">Create one</Link></div>
        </section>
      </div>
    </main>
  );
}
