import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import './DashboardLayout.css';

const DashboardLayout = () => {
    const token = localStorage.getItem('token');

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="layout-container">
            <Sidebar />
            <div className="main-wrapper">
                <Navbar />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
