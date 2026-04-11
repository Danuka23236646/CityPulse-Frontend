import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, AlertCircle, CheckSquare, MessageSquare, Bell, BarChart2, LogOut } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
    const navigate = useNavigate();
    // Extract role from the user object directly, fallback to localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || localStorage.getItem('role') || 'citizen';

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        navigate('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2 className="logo text-gradient">CityPulse</h2>
            </div>
            <nav className="sidebar-nav">
                <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                    <LayoutDashboard size={20} />
                    <span>Dashboard</span>
                </NavLink>
                <NavLink to="/issues" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                    <AlertCircle size={20} />
                    <span>Issues</span>
                </NavLink>
                {(role === 'officer' || role === 'admin') && (
                    <NavLink to="/assignments" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                        <CheckSquare size={20} />
                        <span>Assignments</span>
                    </NavLink>
                )}
                <NavLink to="/feedback" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                    <MessageSquare size={20} />
                    <span>Feedback</span>
                </NavLink>
                <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                    <Bell size={20} />
                    <span>Notifications</span>
                </NavLink>
                {role === 'admin' && (
                    <NavLink to="/reports" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                        <BarChart2 size={20} />
                        <span>Reports</span>
                    </NavLink>
                )}
            </nav>
            <div className="sidebar-footer">
                <button onClick={handleLogout} className="logout-btn">
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
