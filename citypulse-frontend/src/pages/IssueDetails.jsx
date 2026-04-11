import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getIssueById, updateIssueStatus, assignIssue, reassignIssue, getOfficers } from '../services/issue.service';
import { getAssignmentsByOfficer } from '../services/assignment.service';
import { AlertCircle, Clock, MapPin, User as UserIcon } from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatSriLankaDateTime } from '../utils/dateTime';
import './IssueDetails.css';

const configuredBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:5000';
const BACKEND_BASE_URL = configuredBaseUrl.replace(/\/$/, '').replace(/\/api$/, '');

const toAbsoluteUrl = (rawUrl) => {
    const url = String(rawUrl || '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('//')) return `${window.location.protocol}${url}`;
    return `${BACKEND_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const extractImageUrls = (issue) => {
    if (!issue || typeof issue !== 'object') return [];

    const candidateLists = [
        issue.images,
        issue.imageUrls,
        issue.photos,
        issue.attachments,
        issue.media,
        issue.files,
    ];

    const collected = [];
    candidateLists.forEach((list) => {
        if (!Array.isArray(list)) return;

        list.forEach((item) => {
            if (typeof item === 'string') {
                const resolved = toAbsoluteUrl(item);
                if (resolved) collected.push(resolved);
                return;
            }

            if (item && typeof item === 'object') {
                const possibleUrl = item.url || item.path || item.secure_url || item.imageUrl || item.location;
                const resolved = toAbsoluteUrl(possibleUrl);
                if (resolved) collected.push(resolved);
            }
        });
    });

    return Array.from(new Set(collected));
};

const pickNearbyPlaceLabel = (data) => {
    if (!data || typeof data !== 'object') return '';
    if (data.name) return String(data.name);

    const address = data.address || {};
    const preferred = [
        address.amenity,
        address.building,
        address.road,
        address.neighbourhood,
        address.suburb,
        address.city,
        address.town,
        address.village,
    ].find(Boolean);

    return preferred ? String(preferred) : String(data.display_name || '');
};

const getActiveAssignmentId = (issue) => {
    if (!issue || typeof issue !== 'object') return '';

    const directCandidates = [
        issue.assignmentId,
        issue.activeAssignmentId,
        issue.currentAssignmentId,
        issue.assignment?._id,
        issue.activeAssignment?._id,
        issue.currentAssignment?._id,
        issue.latestAssignment?._id,
    ];

    const firstDirect = directCandidates.find((value) => Boolean(value));
    if (firstDirect) return String(firstDirect);

    if (Array.isArray(issue.assignments)) {
        const active = issue.assignments.find((assignment) => {
            const status = String(assignment?.status || '').toLowerCase();
            return status && !['completed', 'cancelled', 'reassigned'].includes(status);
        });
        if (active?._id) return String(active._id);
    }

    return '';
};

const unwrapAssignments = (responseData) => {
    const data = responseData?.data || responseData;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.assignments)) return data.assignments;
    return [];
};

const IssueDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [issue, setIssue] = useState(null);
    const [officers, setOfficers] = useState([]);

    // Form states
    const [selectedOfficer, setSelectedOfficer] = useState('');
    const [assignNotes, setAssignNotes] = useState('');
    const [deadline, setDeadline] = useState('');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [nearbyPlaceName, setNearbyPlaceName] = useState('');
    const [placeResolving, setPlaceResolving] = useState(false);

    const userRole = localStorage.getItem('role') || 'citizen';

    useEffect(() => {
        fetchIssue();
        // Only admins may fetch the officers list (used for assigning)
        if (userRole === 'admin') {
            fetchOfficersList();
        }
    }, [id]);

    const fetchIssue = async () => {
        try {
            const res = await getIssueById(id);
            setIssue(res.data || res);
        } catch (err) {
            setError('Failed to load issue details.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchOfficersList = async () => {
        try {
            const res = await getOfficers();
            setOfficers(res.data || res || []);
        } catch (err) {
            console.error("Failed to load officers", err);
        }
    }

    const handleStatusChange = async (newStatus) => {
        setStatusUpdating(true);
        try {
            await updateIssueStatus(id, newStatus);
            fetchIssue(); // Refresh data
        } catch (err) {
            alert('Failed to update status');
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedOfficer) return alert('Please select an officer');

        if (issue?.assignedTo?._id && selectedOfficer === issue.assignedTo._id) {
            return alert('This issue is already assigned to the selected officer.');
        }

        setStatusUpdating(true);
        try {
            if (issue?.assignedTo) {
                let assignmentId = getActiveAssignmentId(issue);

                // Fallback: fetch active assignment via admin route /assignments/officer/:id
                if (!assignmentId && issue.assignedTo?._id) {
                    const officerAssignmentsRes = await getAssignmentsByOfficer(issue.assignedTo._id);
                    const officerAssignments = unwrapAssignments(officerAssignmentsRes);

                    const matchedAssignment = officerAssignments.find((assignment) => {
                        const issueIdFromAssignment = assignment?.issue?._id || assignment?.issue;
                        const status = String(assignment?.status || '').toLowerCase();
                        const isActive = !['completed', 'cancelled', 'reassigned'].includes(status);
                        return String(issueIdFromAssignment) === String(id) && isActive;
                    });

                    assignmentId = matchedAssignment?._id ? String(matchedAssignment._id) : '';
                }

                if (!assignmentId) {
                    throw new Error('Unable to find active assignment id for reassignment. Please refresh and try again.');
                }

                await reassignIssue(assignmentId, {
                    newOfficerId: selectedOfficer,
                    notes: assignNotes || undefined,
                });
            } else {
                await assignIssue(id, {
                    assignedTo: selectedOfficer,
                    notes: assignNotes,
                    deadline: deadline || undefined,
                    priority: issue.priority || 'medium'
                });
            }

            setSelectedOfficer('');
            setAssignNotes('');
            setDeadline('');
            fetchIssue(); // Refresh to show new assignment
        } catch (err) {
            alert(err.response?.data?.message || err.message || 'Failed to assign/reassign issue');
        } finally {
            setStatusUpdating(false);
        }
    }

    const issueLng = Number(issue?.location?.coordinates?.[0]);
    const issueLat = Number(issue?.location?.coordinates?.[1]);
    const hasValidCoordinates =
        !Number.isNaN(issueLng) &&
        !Number.isNaN(issueLat) &&
        issueLat >= -90 &&
        issueLat <= 90 &&
        issueLng >= -180 &&
        issueLng <= 180;

    useEffect(() => {
        if (!hasValidCoordinates) {
            setNearbyPlaceName('');
            setPlaceResolving(false);
            return;
        }

        let cancelled = false;
        const resolvePlaceName = async () => {
            setPlaceResolving(true);
            try {
                const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${issueLat}&lon=${issueLng}&zoom=17&addressdetails=1`;
                const response = await fetch(reverseUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en'
                    }
                });
                if (!response.ok) {
                    throw new Error('Reverse geocoding failed');
                }

                const data = await response.json();
                const place = pickNearbyPlaceLabel(data);

                if (!cancelled) {
                    setNearbyPlaceName(place);
                }
            } catch (err) {
                if (!cancelled) {
                    setNearbyPlaceName('');
                }
            } finally {
                if (!cancelled) {
                    setPlaceResolving(false);
                }
            }
        };

        resolvePlaceName();

        return () => {
            cancelled = true;
        };
    }, [hasValidCoordinates, issueLat, issueLng]);

    if (loading) return <div className="issue-loading animate-fade-in p-4">Loading issue details...</div>;
    if (error) return <div className="auth-error animate-fade-in m-4">{error}</div>;
    if (!issue) return <div className="animate-fade-in p-4">Issue not found.</div>;

    const issueAddress = issue.location?.address ? String(issue.location.address) : '';
    const imageUrls = extractImageUrls(issue);
    const locationMetaText = placeResolving
        ? 'Finding nearby place...'
        : (nearbyPlaceName || issueAddress || (hasValidCoordinates ? `${issueLat.toFixed(5)}, ${issueLng.toFixed(5)}` : issue.category));

    const getStatusBadge = (status) => {
        const statusClasses = {
            'open': 'badge-warning',
            'assigned': 'badge-primary',
            'in-progress': 'badge-primary',
            'resolved': 'badge-success',
            'closed': 'badge-success'
        };
        return <span className={`badge ${statusClasses[status] || 'badge-default'}`}>{status.toUpperCase()}</span>;
    };

    return (
        <div className="issue-details-container animate-fade-in">
            <div className="issue-top">
                <button className="btn-secondary" onClick={() => navigate('/issues')}>&larr; Back to Issues</button>
                <div className="status-badge-wrapper">{getStatusBadge(issue.status)}</div>
            </div>

            <div className="card issue-card">
                <div className="issue-header">
                    <div className="issue-icon">
                        <AlertCircle size={28} className="text-primary" />
                    </div>

                    <div style={{ flex: 1 }}>
                        <h1 className="issue-title mb-1" style={{ fontSize: '1.75rem' }}>{issue.title}</h1>

                        <div className="issue-meta-grid">
                            <div className="meta-item meta-item-location"><MapPin size={16} /> <span>{locationMetaText}</span></div>
                            <div className="meta-item"><Clock size={16} /> <span>{formatSriLankaDateTime(issue.createdAt)}</span></div>
                            <div className="meta-item"><UserIcon size={16} /> <span>Reported By: <strong>{issue.reportedBy?.name || 'Citizen'}</strong></span></div>
                            <div className="meta-item"><span className={`badge priority-${issue.priority}`}>{issue.priority} priority</span></div>
                        </div>
                    </div>
                </div>

                <div className="issue-description">
                    <h3 className="mb-2">Description</h3>
                    <p>{issue.description}</p>
                </div>

                <div className="issue-location-panel">
                    <h3 className="mb-2">Reported Location</h3>
                    {hasValidCoordinates ? (
                        <>
                            <div className="location-text-row">
                                <span>
                                    Coordinates: [{issueLng.toFixed(6)}, {issueLat.toFixed(6)}]
                                </span>
                                {issueAddress && <span>Address: {issueAddress}</span>}
                            </div>

                            <MapContainer
                                center={[issueLat, issueLng]}
                                zoom={15}
                                className="issue-location-map"
                                scrollWheelZoom
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <CircleMarker center={[issueLat, issueLng]} radius={10} pathOptions={{ color: '#3b82f6' }}>
                                    <Popup>
                                        <div>
                                            <strong>{issue.title}</strong>
                                            <div>[{issueLng.toFixed(6)}, {issueLat.toFixed(6)}]</div>
                                            {issueAddress && <div>{issueAddress}</div>}
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            </MapContainer>

                            <a
                                href={`https://www.google.com/maps?q=${issueLat},${issueLng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="map-open-link"
                            >
                                Open in Google Maps
                            </a>
                        </>
                    ) : (
                        <p className="location-empty">Location coordinates were not provided for this issue.</p>
                    )}
                </div>

                <div className="issue-images-panel">
                    <h3 className="mb-2">Citizen Uploaded Photos</h3>
                    {imageUrls.length > 0 ? (
                        <div className="issue-image-grid">
                            {imageUrls.map((imageUrl, index) => (
                                <a
                                    key={`${imageUrl}-${index}`}
                                    href={imageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="issue-image-link"
                                >
                                    <img
                                        src={imageUrl}
                                        alt={`Issue upload ${index + 1}`}
                                        className="issue-image"
                                        loading="lazy"
                                    />
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="location-empty">No photos were uploaded by the citizen for this issue.</p>
                    )}
                </div>

                {issue.assignedTo && (
                    <div className="assign-box">
                        <div className="assign-box-title">Currently Assigned To</div>
                        <div className="assign-box-content">{issue.assignedTo.name} ({issue.assignedTo.email})</div>
                    </div>
                )}

                {issue.status === 'resolved' && userRole === 'citizen' && (
                    <div className="resolved-box">
                        <h3 className="resolved-title">Issue Resolved!</h3>
                        <p className="resolved-text">How was your experience with the resolution? Your feedback helps us improve.</p>
                        <div className="resolved-actions">
                            <button
                                className="btn-primary"
                                onClick={() => navigate(`/feedback?issueId=${issue._id}`)}
                            >
                                Give Feedback
                            </button>
                        </div>
                    </div>
                )}

                {userRole === 'admin' && (
                    <div className="admin-actions">
                        <div className="p-3 border rounded d-flex flex-column">
                            <h4 className="mb-2">Update Status</h4>
                            <select
                                className="input-field"
                                style={{ height: '42px' }}
                                value={issue.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                disabled={statusUpdating}
                            >
                                <option value="open">Open</option>
                                <option value="assigned">Assigned</option>
                                <option value="in-progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>

                        <div className="p-3 border rounded d-flex flex-column">
                            <h4 className="mb-2">Dispatch / Assign Officer</h4>
                            <div className="d-flex flex-column gap-2 h-full">
                                <div className="d-flex gap-2">
                                    <select
                                        className="input-field"
                                        style={{ flex: 2, height: '42px' }}
                                        value={selectedOfficer}
                                        onChange={e => setSelectedOfficer(e.target.value)}
                                        disabled={statusUpdating || issue.status === 'resolved' || issue.status === 'closed'}
                                    >
                                        <option value="">Select an Officer...</option>
                                        {Array.isArray(officers) && officers.map(off => (
                                            <option key={off._id} value={off._id}>{off.name}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="date"
                                        className="input-field"
                                        style={{ flex: 1, height: '42px' }}
                                        value={deadline}
                                        onChange={e => setDeadline(e.target.value)}
                                        disabled={statusUpdating || issue.status === 'resolved' || issue.status === 'closed'}
                                    />
                                </div>
                                <textarea
                                    className="input-field"
                                    placeholder="Assignment Notes"
                                    rows="1"
                                    style={{ minHeight: '42px', resize: 'vertical' }}
                                    value={assignNotes}
                                    onChange={e => setAssignNotes(e.target.value)}
                                    disabled={statusUpdating || issue.status === 'resolved' || issue.status === 'closed'}
                                ></textarea>
                                <button
                                    className="btn-primary"
                                    style={{ height: '42px', width: '100%' }}
                                    onClick={handleAssign}
                                    disabled={statusUpdating || !selectedOfficer || issue.status === 'resolved' || issue.status === 'closed'}
                                >
                                    {statusUpdating
                                        ? (issue.assignedTo ? 'Reassigning...' : 'Assigning...')
                                        : (issue.assignedTo ? 'Reassign Officer' : 'Assign Officer')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );

};

export default IssueDetails;
