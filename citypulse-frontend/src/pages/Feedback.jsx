import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, Star, Info } from 'lucide-react';
import { getFeedback, getMyFeedback, submitFeedback, updateFeedback, replyToFeedback, deleteFeedback } from '../services/feedback.service';
import { getIssues } from '../services/issue.service';
import { formatSriLankaDateTime } from '../utils/dateTime';
import './Feedback.css';

const ISSUE_PAGE_SIZE = 100;

const toArray = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.feedbacks)) return data.feedbacks;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
};

const clampRating = (value) => {
    const num = Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.min(5, Math.max(1, Math.round(num)));
};

const resolveIssueTitle = (rawIssue, fallbackTitle) => {
    if (fallbackTitle) return String(fallbackTitle);
    if (rawIssue && typeof rawIssue === 'object' && rawIssue.title) return String(rawIssue.title);
    if (typeof rawIssue === 'string') return `Issue ${rawIssue.slice(-6).toUpperCase()}`;
    return 'General Service';
};

const resolveIssueId = (item) => {
    if (item?.issueId) return String(item.issueId);
    if (item?.issue && typeof item.issue === 'object' && item.issue._id) return String(item.issue._id);
    if (item?.issue && typeof item.issue === 'string') return String(item.issue);
    return '';
};

const resolveCitizenName = (item) => (
    item?.citizen?.name ||
    item?.user?.name ||
    item?.reportedBy?.name ||
    'Anonymous Citizen'
);

const normalizeFeedbackItem = (item) => ({
    replies: Array.isArray(item?.replies) ? item.replies : [],
    _id: item?._id || `${item?.issue || 'feedback'}-${item?.createdAt || Math.random()}`,
    rating: clampRating(item?.rating),
    comment: String(item?.comment || '').trim() || 'No comment provided.',
    createdAt: item?.createdAt || item?.updatedAt || null,
    citizenName: resolveCitizenName(item),
    issueTitle: resolveIssueTitle(item?.issue, item?.issueTitle),
    issueId: resolveIssueId(item),
    isAnonymous: Boolean(item?.isAnonymous),
    officerReply: (() => {
        const replies = Array.isArray(item?.replies) ? item.replies : [];
        const latest = replies.length > 0 ? replies[replies.length - 1] : null;
        return latest?.text || latest?.comment || '';
    })(),
});

const unwrapIssuesPayload = (responseData) => {
    const root = responseData && typeof responseData === 'object' && responseData.data && typeof responseData.data === 'object'
        ? responseData.data
        : responseData;

    if (Array.isArray(root)) {
        return { issues: root, pagination: null, total: root.length };
    }

    const issues = Array.isArray(root?.issues) ? root.issues : [];
    const pagination = root?.pagination || null;
    const total = Number(pagination?.total ?? root?.total ?? root?.count ?? issues.length) || issues.length;

    return { issues, pagination, total };
};

const fetchAllIssues = async (params = {}) => {
    const first = await getIssues({ ...params, page: 1, limit: ISSUE_PAGE_SIZE });
    const firstPage = unwrapIssuesPayload(first);

    let allIssues = [...firstPage.issues];
    const totalPages = Number(firstPage.pagination?.totalPages) || 1;

    if (totalPages > 1) {
        const requests = [];
        for (let page = 2; page <= totalPages; page += 1) {
            requests.push(getIssues({ ...params, page, limit: ISSUE_PAGE_SIZE }));
        }
        const responses = await Promise.all(requests);
        responses.forEach((res) => {
            const pageData = unwrapIssuesPayload(res);
            allIssues = allIssues.concat(pageData.issues);
        });
    }

    return allIssues;
};

const Feedback = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const preSelectedIssue = queryParams.get('issueId');

    const [feedbacks, setFeedbacks] = useState([]);
    const [resolvedIssues, setResolvedIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState(null);
    const [editLoading, setEditLoading] = useState(false);
    const [editFormData, setEditFormData] = useState({
        rating: 5,
        comment: '',
        isAnonymous: false,
    });
    const [replyingFeedback, setReplyingFeedback] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [replyLoading, setReplyLoading] = useState(false);
    const [deletingFeedback, setDeletingFeedback] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [formData, setFormData] = useState({
        issueId: preSelectedIssue || '',
        rating: 5,
        comment: ''
    });

    const userRole = localStorage.getItem('role') || 'citizen';

    useEffect(() => {
        fetchFeedback();
        if (userRole === 'citizen') {
            fetchResolvedIssues();
        }
    }, [userRole]);

    const fetchFeedback = async () => {
        try {
            const data = userRole === 'citizen'
                ? await getMyFeedback()
                : await getFeedback();

            const normalized = toArray(data)
                .map(normalizeFeedbackItem)
                .sort((a, b) => {
                    const tA = new Date(a.createdAt || 0).getTime();
                    const tB = new Date(b.createdAt || 0).getTime();
                    return tB - tA;
                });
            setFeedbacks(normalized);
        } catch (err) {
            console.error('Failed to fetch feedback', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchResolvedIssues = async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const issuesArray = await fetchAllIssues({
                status: 'resolved',
                reportedBy: user._id || user.id
            });

            setResolvedIssues(issuesArray);

            if (issuesArray.length > 0 && !formData.issueId) {
                setFormData((prev) => ({ ...prev, issueId: issuesArray[0]._id }));
            }
        } catch (err) {
            console.error('Failed to fetch resolved issues', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.issueId) {
            alert('Please select an issue to provide feedback for.');
            return;
        }

        setSubmitLoading(true);
        try {
            const postData = {
                rating: parseInt(formData.rating, 10),
                comment: formData.comment
            };
            await submitFeedback(formData.issueId, postData);
            setFormData((prev) => ({ ...prev, rating: 5, comment: '' }));
            alert('Thank you for your feedback!');
            fetchFeedback();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to submit feedback');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleFeedbackOpen = (issueId) => {
        if (!issueId) return;
        navigate(`/issues/${issueId}`);
    };

    const handleOpenEdit = (feedbackItem, event) => {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        setEditingFeedback(feedbackItem);
        setEditFormData({
            rating: clampRating(feedbackItem?.rating || 5),
            comment: String(feedbackItem?.comment || ''),
            isAnonymous: Boolean(feedbackItem?.isAnonymous),
        });
    };

    const handleCloseEdit = () => {
        if (editLoading) return;
        setEditingFeedback(null);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editingFeedback?._id) return;

        setEditLoading(true);
        try {
            await updateFeedback(editingFeedback._id, {
                rating: clampRating(editFormData.rating),
                comment: String(editFormData.comment || '').trim(),
                isAnonymous: Boolean(editFormData.isAnonymous),
            });

            setEditingFeedback(null);
            alert('Feedback updated successfully.');
            fetchFeedback();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update feedback.');
        } finally {
            setEditLoading(false);
        }
    };

    const handleOpenReply = (feedbackItem, event) => {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        setReplyingFeedback(feedbackItem);
        setReplyText('');
    };

    const handleCloseReply = () => {
        if (replyLoading) return;
        setReplyingFeedback(null);
        setReplyText('');
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyingFeedback?._id) return;

        const text = String(replyText || '').trim();
        if (!text) {
            alert('Reply text is required.');
            return;
        }

        setReplyLoading(true);
        try {
            await replyToFeedback(replyingFeedback._id, { text });
            alert('Reply posted successfully.');
            setReplyingFeedback(null);
            setReplyText('');
            fetchFeedback();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to post reply.');
        } finally {
            setReplyLoading(false);
        }
    };

    const handleOpenDelete = (feedbackItem, event) => {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        setDeletingFeedback(feedbackItem);
    };

    const handleCloseDelete = () => {
        if (deleteLoading) return;
        setDeletingFeedback(null);
    };

    const handleDeleteSubmit = async () => {
        if (!deletingFeedback?._id) return;

        setDeleteLoading(true);
        try {
            const res = await deleteFeedback(deletingFeedback._id);
            alert(res?.message || 'Feedback deleted successfully.');
            setDeletingFeedback(null);
            setFeedbacks((prev) => prev.filter((item) => item._id !== deletingFeedback._id));
            fetchFeedback();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete feedback.');
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className={`animate-fade-in feedback-layout ${userRole === 'citizen' ? 'is-citizen' : 'is-review-only'}`}>
            <div>
                <h1 className="page-title mb-1">Citizen Feedback</h1>
                

                <div className="issues-list">
                    {loading ? (
                        <div className="empty-state">Loading feedback gallery...</div>
                    ) : feedbacks.length === 0 ? (
                        <div className="empty-state">No stories shared yet.</div>
                    ) : (
                        feedbacks.map((f) => (
                            <div
                                key={f._id}
                                className={`card mb-4 animate-fade-in feedback-card ${f.issueId ? 'feedback-card-clickable' : ''}`}
                                onClick={() => handleFeedbackOpen(f.issueId)}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && f.issueId) {
                                        e.preventDefault();
                                        handleFeedbackOpen(f.issueId);
                                    }
                                }}
                                role={f.issueId ? 'button' : undefined}
                                tabIndex={f.issueId ? 0 : -1}
                                aria-label={f.issueId ? `Open issue details for ${f.issueTitle}` : undefined}
                                title={f.issueId ? 'Click to view issue details' : 'Issue details unavailable'}
                            >
                                <div className="d-flex justify-between mb-3 feedback-head">
                                    <div className="d-flex align-center gap-2 feedback-author-wrap">
                                        <div className="stat-icon bg-primary-light feedback-icon">
                                            <MessageSquare size={16} className="text-primary" />
                                        </div>
                                        <div className="feedback-author-info">
                                            <span className="feedback-author-name">{f.citizenName}</span>
                                            <span className="feedback-issue-title">On {f.issueTitle}</span>
                                        </div>
                                    </div>
                                    <div className="d-flex align-center gap-1 feedback-rating-wrap">
                                        <Star size={16} fill="var(--warning-color)" className="text-warning" />
                                        <span className="font-weight-bold text-warning">{f.rating}</span>
                                        {userRole === 'citizen' && (
                                            <button
                                                type="button"
                                                className="btn-secondary feedback-edit-btn"
                                                onClick={(event) => handleOpenEdit(f, event)}
                                            >
                                                Edit
                                            </button>
                                        )}
                                        {userRole === 'admin' && (
                                            <button
                                                type="button"
                                                className="btn-secondary feedback-reply-btn"
                                                onClick={(event) => handleOpenReply(f, event)}
                                            >
                                                Reply
                                            </button>
                                        )}
                                        {(userRole === 'admin' || userRole === 'citizen') && (
                                            <button
                                                type="button"
                                                className="btn-secondary feedback-delete-btn"
                                                onClick={(event) => handleOpenDelete(f, event)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="feedback-comment mb-0">"{f.comment}"</p>
                                <div className="feedback-date text-muted">{formatSriLankaDateTime(f.createdAt)}</div>
                                {f.officerReply && (
                                    <div className="mt-3 pt-3 border-top feedback-reply-wrap">
                                        <p className="text-primary font-weight-bold mb-1">Admin Response:</p>
                                        <p className="mb-0 text-muted">{f.officerReply}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {userRole === 'citizen' && (
                <div>
                    <div className="card feedback-form-panel">
                        <h2 className="card-title mb-4">Share Your Experience</h2>

                        {resolvedIssues.length === 0 && !preSelectedIssue ? (
                            <div className="p-3 bg-primary-light rounded d-flex gap-3 align-start">
                                <Info className="text-primary mt-1" size={20} />
                                <p className="mb-0 text-muted feedback-help-text">
                                    You can provide feedback for issues that have been <strong>Resolved</strong>. Check your issues list to see if any are ready.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <div className="form-group mb-4">
                                    <label className="form-label">Related Issue</label>
                                    <select
                                        className="input-field"
                                        value={formData.issueId}
                                        onChange={(e) => setFormData({ ...formData, issueId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select an issue...</option>
                                        {resolvedIssues.map((issue) => (
                                            <option key={issue._id} value={issue._id}>
                                                {issue.title}
                                            </option>
                                        ))}
                                        {preSelectedIssue && !resolvedIssues.find((i) => i._id === preSelectedIssue) && (
                                            <option value={preSelectedIssue}>Current Issue</option>
                                        )}
                                    </select>
                                </div>

                                <div className="form-group mb-4">
                                    <label className="form-label d-flex justify-between">
                                        <span>Satisfaction Rating</span>
                                        <span className="text-primary font-weight-bold">{formData.rating}/5</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        className="w-full mt-2"
                                        value={formData.rating}
                                        onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                                    />
                                    <div className="d-flex justify-between text-muted mt-1 feedback-range-labels">
                                        <span>Poor</span>
                                        <span>Excellent</span>
                                    </div>
                                </div>

                                <div className="form-group mb-4">
                                    <label className="form-label">Tell us more</label>
                                    <textarea
                                        className="input-field"
                                        rows="4"
                                        placeholder="What did you think of the service?"
                                        value={formData.comment}
                                        onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                                        required
                                    ></textarea>
                                </div>

                                <button
                                    className="btn-primary w-full"
                                    type="submit"
                                    disabled={submitLoading}
                                >
                                    {submitLoading ? 'Submitting...' : 'Post Feedback'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {editingFeedback && (
                <div className="feedback-modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit feedback">
                    <div className="card feedback-edit-modal">
                        <h3 className="mb-2">Edit Feedback</h3>
                        <p className="text-muted mb-3">Update your rating and comment.</p>

                        <form onSubmit={handleEditSubmit}>
                            <div className="form-group mb-3">
                                <label className="form-label d-flex justify-between">
                                    <span>Rating</span>
                                    <span className="text-primary font-weight-bold">{editFormData.rating}/5</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    className="w-full mt-2"
                                    value={editFormData.rating}
                                    onChange={(e) => setEditFormData((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                                />
                            </div>

                            <div className="form-group mb-3">
                                <label className="form-label">Comment</label>
                                <textarea
                                    className="input-field"
                                    rows="4"
                                    value={editFormData.comment}
                                    onChange={(e) => setEditFormData((prev) => ({ ...prev, comment: e.target.value }))}
                                    required
                                ></textarea>
                            </div>

                            <div className="form-group mb-3">
                                <label className="feedback-anon-row">
                                    <input
                                        type="checkbox"
                                        checked={editFormData.isAnonymous}
                                        onChange={(e) => setEditFormData((prev) => ({ ...prev, isAnonymous: e.target.checked }))}
                                    />
                                    <span>Post anonymously</span>
                                </label>
                            </div>

                            <div className="feedback-edit-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleCloseEdit}
                                    disabled={editLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={editLoading}
                                >
                                    {editLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {replyingFeedback && (
                <div className="feedback-modal-backdrop" role="dialog" aria-modal="true" aria-label="Reply to feedback">
                    <div className="card feedback-reply-modal">
                        <h3 className="mb-2">Reply to Feedback</h3>
                        <p className="text-muted mb-2">Issue: {replyingFeedback.issueTitle}</p>
                        <p className="feedback-comment mb-3">"{replyingFeedback.comment}"</p>

                        <form onSubmit={handleReplySubmit}>
                            <div className="form-group mb-3">
                                <label className="form-label">Reply Text</label>
                                <textarea
                                    className="input-field"
                                    rows="4"
                                    placeholder="Thank you for your feedback. We will address this."
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    required
                                ></textarea>
                            </div>

                            <div className="feedback-edit-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleCloseReply}
                                    disabled={replyLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={replyLoading}
                                >
                                    {replyLoading ? 'Posting...' : 'Post Reply'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deletingFeedback && (
                <div className="feedback-modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete feedback confirmation">
                    <div className="card feedback-delete-modal">
                        <h3 className="mb-2">Delete Feedback?</h3>
                        <p className="text-muted mb-2">This action cannot be undone.</p>
                        <p className="feedback-comment mb-3">"{deletingFeedback.comment}"</p>

                        <div className="feedback-edit-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleCloseDelete}
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary feedback-delete-confirm-btn"
                                onClick={handleDeleteSubmit}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Feedback;
