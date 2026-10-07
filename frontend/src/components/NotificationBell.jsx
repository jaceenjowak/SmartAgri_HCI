import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await API.get('/notifications/unread-count');
        if (active) setCount(Number(response.data?.count) || 0);
      } catch {
        // Keep the last known count instead of hiding the badge on transient errors.
      }
    };
    load();
    const onFocus = () => load();
    const onNotificationUpdate = () => load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('smartagri:notifications-updated', onNotificationUpdate);
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('smartagri:notifications-updated', onNotificationUpdate);
    };
  }, []);
  return <button className="icon-btn" type="button" title={count ? `${count} unread notifications` : 'Notifications'} aria-label={count ? `Notifications, ${count} unread` : 'Notifications'} onClick={() => navigate('/notifications')}>🔔{count > 0 && <span className="notify-badge">{count > 99 ? '99+' : count}</span>}</button>;
}
