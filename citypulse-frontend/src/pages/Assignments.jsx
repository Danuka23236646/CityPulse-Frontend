import React, { useEffect, useState } from 'react';
import { getMyAssignments, getAssignmentsByOfficer, completeAssignment, deleteAssignment } from '../services/assignment.service';
import { getOfficers } from '../services/issue.service';
import { CheckSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatSriLankaDate } from '../utils/dateTime';
import './Assignments.css';

const Assignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [officers, setOfficers] = useState([]);
    const [selectedOfficerId, setSelectedOfficerId] = useState('');
    const [loading, setLoading] = useState(true);
    const [pendingDeleteAssignment, setPendingDeleteAssignment] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const userRole = localStorage.getItem('role') || 'citizen';

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3200);
    };

    useEffect(() => {
        if (userRole === 'admin') {
            fetchOfficerList();
        } else {
            fetchAssignments();
        }
    }, [userRole]);

    useEffect(() => {
        if (userRole === 'admin' && selectedOfficerId) {
            fetchAssignments(selectedOfficerId);
        }
    }, [selectedOfficerId, userRole]);

    const unwrapAssignments = (responseData) => {
        const data = responseData?.data || responseData;
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.assignments)) return data.assignments;
        return [];
    };

    const normalizeAssignmentsForView = (items) => {
        const source = Array.isArray(items) ? items : [];

        // Hide historical/system statuses that cause duplicate issue rows in current operational views.
        return source.filter((assignment) => {
            const status = String(assignment?.status || '').toLowerCase();
            return !['reassigned', 'cancelled'].includes(status);
        });
    };

    const fetchOfficerList = async () => {
        setLoading(true);
        try {
            const res = await getOfficers();
            const list = res.data || res || [];
            const normalized = Array.isArray(list) ? list : [];
            setOfficers(normalized);

            if (normalized.length > 0) {
                setSelectedOfficerId((prev) => prev || normalized[0]._id);
            } else {
                setAssignments([]);
            }
        } catch (err) {
            console.error('Failed to load officers', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAssignments = async (officerIdForAdmin) => {
        setLoading(true);
        try {
            if (userRole === 'admin') {
                if (!officerIdForAdmin) {
                    setAssignments([]);
                    return;
                }
                const res = await getAssignmentsByOfficer(officerIdForAdmin);
                setAssignments(normalizeAssignmentsForView(unwrapAssignments(res)));
                return;
            }

            const res = await getMyAssignments();
            setAssignments(normalizeAssignmentsForView(unwrapAssignments(res)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async (id) => {
        try {
            await completeAssignment(id);
            if (userRole === 'admin') {
                fetchAssignments(selectedOfficerId);
            } else {
                fetchAssignments();
            }
        } catch (err) {
            alert('Failed to complete assignment');
        }
    };

    const openDeleteConfirm = (assignment) => {
        setPendingDeleteAssignment(assignment);
    };

    const closeDeleteConfirm = () => {
        if (deleteLoading) return;
        setPendingDeleteAssignment(null);
    };

    const handleDeleteAssignment = async () => {
        if (!pendingDeleteAssignment?._id) return;

        setDeleteLoading(true);
        try {
            const res = await deleteAssignment(pendingDeleteAssignment._id);
            const successMessage = res?.message || 'Assignment cancelled and issue returned to open pool.';
            showToast('success', successMessage);

            // Optimistic UI removal so admin immediately sees it disappear.
            setAssignments((prev) => prev.filter((assignment) => assignment._id !== pendingDeleteAssignment._id));

            setPendingDeleteAssignment(null);
            if (userRole === 'admin') {
                fetchAssignments(selectedOfficerId);
            } else {
                fetchAssignments();
            }
        } catch (err) {
            const status = err?.response?.status;
            if (status === 404) {
                showToast('error', 'Assignment not found. It may have already been removed.');
            } else if (status === 401 || status === 403) {
                showToast('error', 'You are not authorized to delete assignments. Please login as admin.');
            } else if (status >= 500) {
                showToast('error', 'Server error while deleting assignment. Please try again.');
            } else {
                showToast('error', err?.response?.data?.message || 'Failed to delete assignment.');
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <h1 className="page-title">{userRole === 'admin' ? 'Officer Assignments' : 'My Assignments'}</h1>
            <p className="subtitle mb-4">
                {userRole === 'admin' ? 'View assignments by officer.' : 'View and track tasks assigned to you.'}
            </p>

            {userRole === 'admin' && (
                <div className="assignments-filter-row">
                    <label className="form-label">Select Officer</label>
                    <select
                        className="input-field"
                        value={selectedOfficerId}
                        onChange={(e) => setSelectedOfficerId(e.target.value)}
                        disabled={loading || officers.length === 0}
                    >
                        {officers.length === 0 ? (
                            <option value="">No officers available</option>
                        ) : officers.map((officer) => (
                            <option key={officer._id} value={officer._id}>{officer.name}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="assignments-list">
                {loading ? (
                    <div className="empty-state">Loading assignments...</div>
                ) : assignments.length === 0 ? (
                    <div className="empty-state">
                        {userRole === 'admin' ? 'No assignments found for this officer.' : 'You have no active assignments.'}
                    </div>
                ) : (
                    assignments.map(assignment => (
                        <div key={assignment._id} className="assign-row-card card">
                            <div className="assign-row-main">
                                <div className="assign-row-title-wrap">
                                    <CheckSquare size={18} className="text-primary" />
                                    {assignment.issue?._id ? (
                                        <Link to={`/issues/${assignment.issue._id}`} className="assign-row-title-link">
                                            <h3 className="assign-row-title">{assignment.issue?.title || 'Unknown Issue'}</h3>
                                        </Link>
                                    ) : (
                                        <h3 className="assign-row-title">{assignment.issue?.title || 'Unknown Issue'}</h3>
                                    )}
                                </div>
                                <div className="assign-row-meta">
                                    <span className={`status-pill ${assignment.status === 'completed' ? 'pill-completed' : 'pill-active'}`}>{assignment.status.toUpperCase()}</span>
                                    <span className="assign-deadline">Deadline: {assignment.deadline ? formatSriLankaDate(assignment.deadline) : 'None'}</span>
                                </div>
                                {assignment.notes && <p className="assign-notes">Notes: {assignment.notes}</p>}
                            </div>

                            <div className="assign-row-actions">
                                {userRole === 'officer' && assignment.status !== 'completed' && (
                                    <button
                                        className="btn-primary"
                                        onClick={() => handleComplete(assignment._id)}
                                    >
                                        Mark Completed
                                    </button>
                                )}

                                {userRole === 'admin' && (
                                    <button
                                        className="btn-secondary assign-delete-btn"
                                        onClick={() => openDeleteConfirm(assignment)}
                                    >
                                        Delete Assignment
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {pendingDeleteAssignment && (
                <div className="assign-modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete assignment confirmation">
                    <div className="assign-modal card">
                        <h3 className="mb-2">Delete Assignment?</h3>
                        <p className="text-muted mb-3">
                            This will cancel the assignment and return the issue to the open pool.
                        </p>
                        <p className="assign-modal-issue mb-3">
                            {pendingDeleteAssignment.issue?.title || 'Selected issue'}
                        </p>
                        <div className="assign-modal-actions">
                            <button
                                className="btn-secondary"
                                onClick={closeDeleteConfirm}
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary assign-delete-confirm-btn"
                                onClick={handleDeleteAssignment}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
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

export default Assignments;