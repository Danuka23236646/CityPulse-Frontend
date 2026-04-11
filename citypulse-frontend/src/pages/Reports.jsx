import React, { useEffect, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    TrendingUp, BarChart2, PieChart as PieIcon, Download,
    Plus, Trash2, ToggleLeft, ToggleRight, Calendar, Filter, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import reportService from '../services/report.service';
import { formatSriLankaDate } from '../utils/dateTime';
import './Reports.css';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const formatReportType = (value = '') => value
    .split('_')
    .map(part => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');

const Reports = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState(null);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        reportType: 'ISSUE_SUMMARY',
        filters: {
            categories: [],
            statuses: [],
            startDate: '',
            endDate: ''
        }
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashboardStats, reportsList] = await Promise.all([
                reportService.getAdminDashboard(),
                reportService.getReports()
            ]);
            setStats(dashboardStats);
            setReports(reportsList);
        } catch (err) {
            console.error('Failed to fetch data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateReport = async (e) => {
        e.preventDefault();
        try {
            await reportService.createReport(formData);
            setShowCreateForm(false);
            fetchData();
            // Reset form
            setFormData({
                title: '',
                description: '',
                reportType: 'ISSUE_SUMMARY',
                filters: { categories: [], statuses: [], startDate: '', endDate: '' }
            });
        } catch (err) {
            alert('Failed to create report: ' + (err.response?.data?.message || err.message));
        }
    };

    const toggleStatus = async (id) => {
        try {
            await reportService.toggleReport(id);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const deleteReport = async (id) => {
        if (!window.confirm('Are you sure you want to delete this report configuration?')) return;
        try {
            await reportService.deleteReport(id);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const toggleFilter = (type, value) => {
        setFormData(prev => {
            const current = prev.filters[type];
            const updated = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];
            return { ...prev, filters: { ...prev.filters, [type]: updated } };
        });
    };

    const categories = ['road', 'water', 'electricity', 'waste', 'streetlight', 'drainage'];
    const statuses = ['open', 'assigned', 'in-progress', 'resolved', 'closed'];

    if (loading && !stats) return <div className="p-8 text-center">Loading Analytics...</div>;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="reports-container"
        >
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="page-title mb-1">Analytics & Reports</h1>
                    
                </div>
                <button
                    onClick={reportService.downloadSummaryPdf}
                    className="btn-primary"
                >

                   
                    <Download size={18} /> Quick Export (PDF)
                </button>
            </div>

            <div className="tabs-header">
                <button
                    className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    <BarChart2 size={18} className="inline mr-2" /> Dashboard
                </button>
                <button
                    className={`tab-btn ${activeTab === 'management' ? 'active' : ''}`}
                    onClick={() => setActiveTab('management')}
                >
                    <FileText size={18} className="inline mr-2" /> Report Management
                </button>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'dashboard' ? (
                    <motion.div
                        key="dashboard"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon bg-primary-light">
                                    <TrendingUp className="text-primary" size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>{stats?.totalIssues || 0}</h3>
                                    <p>Total Issues</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon bg-warning-light">
                                    <BarChart2 className="text-warning" size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>{Math.round(stats?.avgResolutionTime || 0)}h</h3>
                                    <p>Avg. Resolution Time</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon bg-success-light">
                                    <PieIcon className="text-success" size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>{stats?.statusStats?.find(s => s._id === 'resolved')?.count || 0}</h3>
                                    <p>Total Resolved</p>
                                </div>
                            </div>
                        </div>

                        <div className="charts-grid">
                            <div className="chart-card">
                                <h3 className="card-title">Monthly Issue Trends</h3>
                                <div style={{ width: '100%', height: 300 }}>
                                    <ResponsiveContainer>
                                        <AreaChart data={stats?.monthlyTrends}>
                                            <defs>
                                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="_id" />
                                            <YAxis />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="count" stroke="#4F46E5" fillOpacity={1} fill="url(#colorCount)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="chart-card">
                                <h3 className="card-title">Status Distribution</h3>
                                <div style={{ width: '100%', height: 300 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={stats?.statusStats}
                                                dataKey="count"
                                                nameKey="_id"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                label
                                            >
                                                {stats?.statusStats?.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="chart-card col-span-full">
                                <h3 className="card-title">Category Analysis</h3>
                                <div style={{ width: '100%', height: 300 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={stats?.categoryStats} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" />
                                            <YAxis dataKey="_id" type="category" width={100} />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="management"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="card-title m-0">Saved Report Configurations</h2>
                            <button
                                onClick={() => setShowCreateForm(!showCreateForm)}
                                className="btn-secondary"
                            >
                                {showCreateForm ? 'Cancel' : <><Plus size={18} /> New Configuration</>}
                            </button>
                        </div>

                        {showCreateForm && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="create-report-section"
                            >
                                <form onSubmit={handleCreateReport}>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Report Title</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="e.g. Monthly Roads Analysis"
                                                required
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Report Type</label>
                                            <select
                                                className="input-field"
                                                value={formData.reportType}
                                                onChange={e => setFormData({ ...formData, reportType: e.target.value })}
                                            >
                                                <option value="ISSUE_SUMMARY">Issue Summary</option>
                                                <option value="CATEGORY_ANALYSIS">Category Analysis</option>
                                                <option value="OFFICER_PERFORMANCE">Officer Performance</option>
                                                <option value="MONTHLY_TRENDS">Monthly Trends</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Categories Filter</label>
                                        <div className="multi-select-grid">
                                            {categories.map(cat => (
                                                <div
                                                    key={cat}
                                                    className={`select-pill ${formData.filters.categories.includes(cat) ? 'selected' : ''}`}
                                                    onClick={() => toggleFilter('categories', cat)}
                                                    style={{ textTransform: 'capitalize' }}
                                                >
                                                    {cat}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Start Date</label>
                                            <input
                                                type="date"
                                                className="input-field"
                                                value={formData.filters.startDate}
                                                onChange={e => setFormData({ ...formData, filters: { ...formData.filters, startDate: e.target.value } })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">End Date</label>
                                            <input
                                                type="date"
                                                className="input-field"
                                                value={formData.filters.endDate}
                                                onChange={e => setFormData({ ...formData, filters: { ...formData.filters, endDate: e.target.value } })}
                                            />
                                        </div>
                                    </div>

                                    <button type="submit" className="btn-primary w-full py-3">
                                        Save Configuration
                                    </button>
                                </form>
                            </motion.div>
                        )}

                        <div className="reports-list-card">
                            <table className="reports-table">
                                <thead>
                                    <tr>
                                        <th>Report Config</th>
                                        <th>Type</th>
                                        <th>Filters</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map(report => (
                                        <tr key={report._id}>
                                            <td className="config-cell">
                                                <div className="report-title">{report.title}</div>
                                                <div className="report-meta">Created: {formatSriLankaDate(report.createdAt)}</div>
                                            </td>
                                            <td className="type-cell">
                                                <span className="report-type-badge">
                                                    {formatReportType(report.reportType)}
                                                </span>
                                            </td>
                                            <td className="filters-cell">
                                                <div className="filters-wrap">
                                                    {(report.filters?.categories || []).map(c => (
                                                        <span key={c} className="filter-chip">{c}</span>
                                                    ))}
                                                    {report.filters?.startDate && (
                                                        <span className="filter-chip date-chip">
                                                            <Calendar size={12} />
                                                            {formatSriLankaDate(report.filters.startDate)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="status-cell">
                                                <label className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={report.isActive}
                                                        onChange={() => toggleStatus(report._id)}
                                                    />
                                                    <span className="slider"></span>
                                                </label>
                                            </td>
                                            <td className="actions-cell">
                                                <div className="action-btns">
                                                    <button
                                                        onClick={() => reportService.downloadReportPdf(report._id, report.title)}
                                                        className="btn-icon"
                                                        title="Download PDF"
                                                        disabled={!report.isActive}
                                                        style={{ opacity: report.isActive ? 1 : 0.5 }}
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteReport(report._id)}
                                                        className="btn-icon btn-danger"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {reports.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="text-center py-8 text-muted">
                                                No saved configurations found. Create one to start generating reports.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default Reports;
