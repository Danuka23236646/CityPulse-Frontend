import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getIssues, deleteIssue } from '../services/issue.service';
import { AlertCircle, Clock, MapPin, Eye, Trash2 } from 'lucide-react';
import { formatSriLankaDate } from '../utils/dateTime';
import './Issues.css';

const PAGE_SIZE = 100;

const unwrapIssuesPayload = (responseData) => {
    const root = responseData && typeof responseData === 'object' && responseData.data && typeof responseData.data === 'object'
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
    const total = Number(pagination?.total ?? root?.total ?? root?.count ?? issues.length) || issues.length;

    return {
        issues,
        pagination,
        total,
    };
};

const fetchAllIssues = async (params = {}) => {
    const firstRes = await getIssues({ ...params, page: 1, limit: PAGE_SIZE });
    const firstPage = unwrapIssuesPayload(firstRes);

    let allIssues = [...firstPage.issues];
    const totalPages = Number(firstPage.pagination?.totalPages) || 1;
    const total = Number(firstPage.total) || allIssues.length;

    if (totalPages > 1) {
        const requests = [];
        for (let page = 2; page <= totalPages; page += 1) {
            requests.push(getIssues({ ...params, page, limit: PAGE_SIZE }));
        }

        const responses = await Promise.all(requests);
        responses.forEach((res) => {
            const pageData = unwrapIssuesPayload(res);
            allIssues = allIssues.concat(pageData.issues);
        });
    }

    // Fallback for APIs that provide total but omit totalPages.
    if (totalPages <= 1 && total > allIssues.length) {
        const pagesNeeded = Math.ceil(total / PAGE_SIZE);
        if (pagesNeeded > 1) {
            const requests = [];
            for (let page = 2; page <= pagesNeeded; page += 1) {
                requests.push(getIssues({ ...params, page, limit: PAGE_SIZE }));
            }

            const responses = await Promise.all(requests);
            responses.forEach((res) => {
                const pageData = unwrapIssuesPayload(res);
                allIssues = allIssues.concat(pageData.issues);
            });
        }
    }

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

const Issues = () => {
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingDeleteIssue, setPendingDeleteIssue] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const userRole = localStorage.getItem('role') || 'citizen';

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3200);
    };

    useEffect(() => {
        fetchIssues();
    }, []);

    const fetchIssues = async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const params = user.role === 'citizen' ? { reportedBy: user._id } : {};
            const fullList = await fetchAllIssues(params);
            setIssues(fullList);
        } catch (err) {
            console.error("Failed to load issues", err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusClasses = {
            'open': 'badge-warning',
            'assigned': 'badge-primary',
            'in-progress': 'badge-primary',
            'resolved': 'badge-success',
            'closed': 'badge-success'
        };
        return <span className={`badge ${statusClasses[status] || 'badge-default'}`}>{toTitleCase(status)}</span>;
    };

    const openDeleteConfirm = (issue, event) => {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        setPendingDeleteIssue(issue);
    };

    const closeDeleteConfirm = () => {
        if (deleteLoading) return;
        setPendingDeleteIssue(null);
    };

    const handleDeleteIssue = async () => {
        if (!pendingDeleteIssue?._id) return;

        setDeleteLoading(true);
        try {
            const response = await deleteIssue(pendingDeleteIssue._id);
            const message = response?.message || 'Issue removed';

            setIssues((prev) => prev.filter((issue) => issue._id !== pendingDeleteIssue._id));
            setPendingDeleteIssue(null);
            showToast('success', message);
        } catch (err) {
            const status = err?.response?.status;
            if (status === 401 || status === 403) {
                showToast('error', 'Only admins can delete issues.');
            } else if (status === 404) {
                showToast('error', 'Issue not found. It may already be removed.');
            } else if (status >= 500) {
                showToast('error', 'Server error while deleting issue. Please try again.');
            } else {
                showToast('error', err?.response?.data?.message || 'Failed to delete issue.');
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="issues-container animate-fade-in">
            <div className="page-header d-flex justify-between align-center">
                <div>
                    <h1 className="page-title mb-0">City Issues</h1>
                    <p className="subtitle">View and track all infrastructure reports.</p>
                </div>

                {userRole === 'citizen' && (
                    <Link to="/issues/new" className="btn-primary">
                        + Report Issue
                    </Link>
                )}
            </div>

            <div className="issues-list">
                {loading ? (
                    <div className="empty-state">Loading issues...</div>
                ) : issues.length === 0 ? (
                    <div className="empty-state">No issues reported yet.</div>
                ) : (
                    issues.map((issue) => (
                        <div key={issue._id} className="issues-row-card card">
                            <div className="issues-row-info">
                                <div className="issues-row-head">
                                    <div className="issues-row-title-group">
                                        <AlertCircle size={20} className="text-muted" />
                                        <h3 className="issues-row-title">{issue.title}</h3>
                                    </div>
                                    <div className="issues-row-badges">
                                        {getStatusBadge(issue.status)}
                                        <span className={`badge priority-${issue.priority}`}>{toTitleCase(issue.priority)} Priority</span>
                                    </div>
                                </div>
                                <div className="issues-row-meta d-flex gap-4 text-muted">
                                    <span className="d-flex align-center gap-1"><MapPin size={16} /> {toTitleCase(issue.category)}</span>
                                    <span className="d-flex align-center gap-1"><Clock size={16} /> {formatSriLankaDate(issue.createdAt)}</span>
                                </div>
                            </div>
                            <div className="issues-row-actions">
                                <Link to={`/issues/${issue._id}`} className="btn-secondary">
                                    <Eye size={18} /> View
                                </Link>
                                {userRole === 'admin' && (
                                    <button
                                        type="button"
                                        className="btn-secondary issues-delete-btn"
                                        onClick={(event) => openDeleteConfirm(issue, event)}
                                    >
                                        <Trash2 size={16} /> Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {pendingDeleteIssue && (
                <div className="issues-modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete issue confirmation">
                    <div className="card issues-modal">
                        <h3 className="mb-2">Delete Issue?</h3>
                        <p className="text-muted mb-3">This will permanently remove the issue from the system.</p>
                        <p className="issues-modal-title mb-3">{pendingDeleteIssue.title}</p>
                        <div className="issues-modal-actions">
                            <button className="btn-secondary" onClick={closeDeleteConfirm} disabled={deleteLoading}>Cancel</button>
                            <button className="btn-primary issues-delete-confirm-btn" onClick={handleDeleteIssue} disabled={deleteLoading}>
                                {deleteLoading ? 'Deleting...' : 'Delete Issue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default Issues;
