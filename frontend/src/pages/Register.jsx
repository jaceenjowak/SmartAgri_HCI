import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', username: '', address: '', phone_number: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password)) return setError('Password needs 8+ characters, uppercase, number, and special character.');
    setLoading(true);
    try {
      const { confirm, ...payload } = form;
      await register(payload);
      navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.message || 'Registration failed. Check the backend connection.'); }
    finally { setLoading(false); }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <section className="auth-visual">
          <Link className="brand" to="/"><img src="/logo.png" alt="SmartAgri" /><div><div className="brand-name">SMARTAGRI</div><div className="brand-sub">FARM</div></div></Link>
          <div className="auth-tagline"><div className="eyebrow">Create your workspace</div><h2>Start with the data. Connect hardware later.</h2><p>New accounts automatically receive default irrigation thresholds and a simulated pump-state row in Supabase.</p></div>
        </section>
        <section className="auth-form-side">
          <div className="eyebrow">New account</div><h1>Create account</h1><p>All fields below are stored through the backend API.</p>
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-row">
              <div className="field"><label>Full name</label><input className="input" value={form.full_name} onChange={set('full_name')} required /></div>
              <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={set('email')} required /></div>
            </div>
            <div className="auth-row">
              <div className="field"><label>Username</label><input className="input" value={form.username} onChange={set('username')} required /></div>
              <div className="field"><label>Phone number</label><input className="input" value={form.phone_number} onChange={set('phone_number')} required /></div>
            </div>
            <div className="field"><label>Address</label><input className="input" value={form.address} onChange={set('address')} required /></div>
            <div className="auth-row">
              <div className="field"><label>Password</label><input className="input" type="password" value={form.password} onChange={set('password')} required /></div>
              <div className="field"><label>Confirm password</label><input className="input" type="password" value={form.confirm} onChange={set('confirm')} required /></div>
            </div>
            {error && <div className="message error">{error}</div>}
            <button className="primary-btn full-btn" disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</button>
          </form>
          <div className="auth-meta">Already registered? <Link to="/login">Sign in</Link></div>
        </section>
      </div>
    </main>
  );
}
