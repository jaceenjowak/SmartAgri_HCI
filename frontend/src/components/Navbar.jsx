import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const links = [
    ['Dashboard', '/dashboard'],
    ['Irrigation Logs', '/logs'],
    ['Settings', '/settings'],
  ];
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link className="brand" to="/dashboard">
          <img src="/logo.png" alt="SmartAgri" />
          <div><div className="brand-name">SMARTAGRI</div><div className="brand-sub">FARM</div></div>
        </Link>
        <nav className="nav-links">
          {links.map(([label, to]) => <Link key={to} className={`nav-link ${location.pathname === to ? 'active' : ''}`} to={to}>{label}</Link>)}
        </nav>
        <div className="nav-actions">
          <NotificationBell />
          <div className="user-chip">👤 <span>{user?.username || 'Farmer'}</span></div>
          <button className="ghost-btn" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </div>
    </header>
  );
}
