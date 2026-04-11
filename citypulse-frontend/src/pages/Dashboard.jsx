import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';
import { formatSriLankaDateTime } from '../utils/dateTime';
import './Dashboard.css';

const PAGE_SIZE = 100;

const unwrapIssuesPayload = (responseData) => {
    const root = responseData?.data && typeof responseData.data === 'object'
        ? responseData.data
        : responseData;

    if (Array.isArray(root)) {
        return {
            issues: root,
            pagination: null,
            total: root.length,
        };
    }

    const issues = Array.isArray(root?.issues) ? root.issues : [];
    const pagination = root?.pagination || null;
    const totalFromPayload =
        pagination?.total ??
        root?.total ??
        root?.count ??
        issues.length;

    return {
        issues,
        pagination,
        total: totalFromPayload,
    };
};

const fetchAllIssues = async (params = {}) => {
    const firstResponse = await api.get('/issues', {
        params: {
            ...params,
            page: 1,
            limit: PAGE_SIZE,
        }
    });

    const firstPage = unwrapIssuesPayload(firstResponse.data || firstResponse);
    let allIssues = [...firstPage.issues];
    const total = Number(firstPage.total) || allIssues.length;
    const totalPages = Number(firstPage.pagination?.totalPages) || 1;

    if (totalPages > 1) {
        const remainingRequests = [];
        for (let page = 2; page <= totalPages; page += 1) {
            remainingRequests.push(
                api.get('/issues', {
                    params: {
                        ...params,
                        page,
                        limit: PAGE_SIZE,
                    }
                })
            );
        }

        const remainingResponses = await Promise.all(remainingRequests);
        remainingResponses.forEach((response) => {
            const data = unwrapIssuesPayload(response.data || response);
            allIssues = allIssues.concat(data.issues);
        });
    }

    // Fallback for APIs that return total but no totalPages
    if (totalPages <= 1 && total > allIssues.length) {
        const pagesNeeded = Math.ceil(total / PAGE_SIZE);
        if (pagesNeeded > 1) {
            const fallbackRequests = [];
            for (let page = 2; page <= pagesNeeded; page += 1) {
                fallbackRequests.push(
                    api.get('/issues', {
                        params: {
                            ...params,
                            page,
                            limit: PAGE_SIZE,
                        }
                    })
                );
            }

            const fallbackResponses = await Promise.all(fallbackRequests);
            fallbackResponses.forEach((response) => {
                const data = unwrapIssuesPayload(response.data || response);
                allIssues = allIssues.concat(data.issues);
            });
        }
    }

    // Keep unique issues in case backend overlaps pages.
    const byId = new Map();
    allIssues.forEach((issue) => {
        if (issue && issue._id) {
            byId.set(issue._id, issue);
        }
    });

    return Array.from(byId.values());
};

const toTitleCase = (value = '') => value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getActivityText = (issue) => {
    const statusText = toTitleCase(issue.status || 'open');

    if (issue.status === 'resolved' || issue.status === 'closed') {
        return `${statusText} issue`;
    }
    if (issue.status === 'assigned') {
        return 'Assigned to officer';
    }
    if (issue.status === 'in-progress') {
        return 'Work in progress';
    }
    return 'New issue reported';
};

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [recentActivities, setRecentActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Fetch dashboard stats depending on role
    useEffect(() => {
        const fetchStats = async () => {
            try {
                // If citizen, only get their own reported issues. If officer, only get assigned issues.
                const params = user.role === 'citizen'
                    ? { reportedBy: user._id }
                    : user.role === 'officer'
                        ? { assignedTo: user._id }
                        : {};
                const issuesList = await fetchAllIssues(params);

                let resolved = 0;
                let active = 0;

                // Count statuses if it's an array
                if (Array.isArray(issuesList)) {
                    issuesList.forEach(i => {
                        if (i.status === 'resolved' || i.status === 'closed') {
                            resolved++;
                        } else if (i.status === 'assigned' || i.status === 'in-progress' || i.status === 'open') {
                            active++;
                        }
                    });
                }

                setStats({
                    total: Array.isArray(issuesList) ? issuesList.length : 0,
                    resolved,
                    active
                });

                const sortedActivities = [...issuesList]
                    .sort((a, b) => {
                        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                        return timeB - timeA;
                    })
                    .slice(0, 6)
                    .map((issue) => ({
                        id: issue._id,
                        title: issue.title || 'Untitled issue',
                        status: issue.status || 'open',
                        category: issue.category || 'general',
                        timestamp: issue.updatedAt || issue.createdAt,
                        actionText: getActivityText(issue),
                    }));

                setRecentActivities(sortedActivities);
            } catch (err) {
                console.error("Failed to load dashboard stats", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [user._id, user.role]);

    // Role-specific rendering
    const renderQuickActions = () => {
        if (user.role === 'admin') {
            return (
                <div className="quick-actions">
                    <button className="btn-primary w-full mb-3" onClick={() => window.location.href = '/reports'}>View Analytics Dashboard</button>
                    <button className="btn-secondary w-full" onClick={() => window.location.href = '/issues'}>Manage City Issues</button>
                </div>
            );
        } else if (user.role === 'officer') {
            return (
                <div className="quick-actions">
                    <button className="btn-primary w-full mb-3" onClick={() => window.location.href = '/assignments'}>View Pending Tasks</button>
                    <button className="btn-secondary w-full" onClick={() => window.location.href = '/issues'}>Update Issues Status</button>
                </div>
            );
        } else {
            // Citizen
            return (
                <div className="quick-actions">
                    <button className="btn-primary w-full mb-3" onClick={() => window.location.href = '/issues/new'}>+ Report New Issue</button>
                    <button className="btn-secondary w-full" onClick={() => window.location.href = '/feedback'}>Leave Service Feedback</button>
                </div>
            );
        }
    };

    const getStatsLabels = () => {
        if (user.role === 'citizen') {
            return { total: 'My Reports', active: 'Active Reports', resolved: 'Resolved Reports' };
        } else if (user.role === 'officer') {
            return { total: 'My Assigned Issues', active: 'Active Operations', resolved: 'Resolved Tasks' };
        }
        return { total: 'Total City Issues', active: 'Active Operations', resolved: 'Resolved City Issues' };
    };

    const labels = getStatsLabels();

    return (
        <div className="dashboard-container animate-fade-in">
            <div className="dashboard-header">
                <h1 className="page-title">Welcome back, {user.name?.split(' ')[0] || 'User'}!</h1>
                <p className="subtitle">
                    {user.role === 'admin'
                        ? 'City administration overview.'
                        : user.role === 'officer'
                            ? 'Your dispatched tasks and assignments.'
                            : 'Here\'s what\'s happening in your neighborhood today.'}
                </p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon bg-primary-light">
                        <Activity className="text-primary" size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>{loading ? '-' : stats?.total}</h3>
                        <p>{labels.total}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon bg-warning-light">
                        <AlertTriangle className="text-warning" size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>{loading ? '-' : stats?.active}</h3>
                        <p>{labels.active}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon bg-success-light">
                        <CheckCircle className="text-success" size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>{loading ? '-' : stats?.resolved}</h3>
                        <p>{labels.resolved}</p>
                    </div>
                </div>
            </div>

            <div className="dashboard-content grid grid-cols-2">
                <div className="card">
                    <h2 className="card-title">Recent Activity</h2>
                    {loading ? (
                        <div className="empty-state">
                            <p>Loading recent activity...</p>
                        </div>
                    ) : recentActivities.length === 0 ? (
                        <div className="empty-state">
                            <p>No recent activity to show.</p>
                        </div>
                    ) : (
                        <div className="recent-activity-list">
                            {recentActivities.map((activity) => (
                                <Link key={activity.id} to={`/issues/${activity.id}`} className="recent-activity-item">
                                    <div className="recent-activity-head">
                                        <h4>{activity.title}</h4>
                                        <span className={`status-pill status-${activity.status}`}>{toTitleCase(activity.status)}</span>
                                    </div>
                                    <p className="recent-activity-text">{activity.actionText}</p>
                                    <div className="recent-activity-meta">
                                        <span>{toTitleCase(activity.category)}</span>
                                        <span>{formatSriLankaDateTime(activity.timestamp)}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
                <div className="card">
                    <h2 className="card-title">Quick Actions</h2>
                    {renderQuickActions()}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
