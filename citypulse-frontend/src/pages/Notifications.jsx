import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api, { SOCKET_BASE_URL } from '../services/api';
import { Bell, Check } from 'lucide-react';
import { formatSriLankaDateTime } from '../utils/dateTime';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        fetchNotifications();

        // Socket setup
        const socket = io(SOCKET_BASE_URL);
        socket.on('connect', () => {
            if (user._id) {
                socket.emit('join', user._id);
            }
        });

        socket.on('receiveNotification', (newNotif) => {
            setNotifications(prev => [newNotif, ...prev]);
        });

        socket.on('notificationRead', (id) => {
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        });

        return () => socket.disconnect();
    }, [user._id]);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications');
            const data = res.data.data || res.data || [];
            setNotifications(Array.isArray(data) ? data : (data.notifications || []));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
        } catch (err) {
            console.error('Failed to mark as read');
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error('Failed to mark all as read');
        }
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="d-flex justify-between align-center mb-4">
                <div>
                    <h1 className="page-title mb-0">Notifications</h1>
                    <p className="subtitle">Stay updated on your reports and tasks.</p>
                </div>
                {notifications.some(n => !n.isRead) && (
                    <button className="btn-secondary" onClick={markAllAsRead}>Mark All as Read</button>
                )}
            </div>

            <div className="issues-list">
                {loading ? (
                    <div className="empty-state">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                    <div className="empty-state">You have no notifications.</div>
                ) : (
                    notifications.map(notif => (
                        <div key={notif._id} className={`card ${!notif.isRead ? 'unread' : ''}`} style={{ backgroundColor: !notif.isRead ? 'rgba(79, 70, 229, 0.05)' : 'var(--surface-light)' }}>
                            <div className="d-flex justify-between align-start">
                                <div className="d-flex gap-3">
                                    <div className="stat-icon bg-primary-light" style={{ width: '40px', height: '40px' }}>
                                        <Bell size={20} className="text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="issue-title" style={{ fontSize: '1rem', marginBottom: '4px' }}>{notif.title}</h4>
                                        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '8px' }}>{notif.message}</p>
                                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>{formatSriLankaDateTime(notif.createdAt)}</span>
                                    </div>
                                </div>
                                {!notif.isRead && (
                                    <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => markAsRead(notif._id)}>
                                        <Check size={14} /> Mark Read
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Notifications;
