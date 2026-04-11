import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { createIssue, suggestIssueDetails } from '../services/issue.service';
import './CreateIssue.css';
import LocationStep from '../components/LocationStep';

const CATEGORY_OPTIONS = [
    { value: 'road', label: 'Road' },
    { value: 'water', label: 'Water' },
    { value: 'electricity', label: 'Electricity' },
    { value: 'waste', label: 'Waste Management' },
    { value: 'streetlight', label: 'Streetlight' },
    { value: 'drainage', label: 'Drainage' }
];

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' }
];

const normalizeCategory = (rawValue) => {
    const value = String(rawValue || '').toLowerCase().trim();
    if (!value) return '';
    if (value.includes('street')) return 'streetlight';
    if (value.includes('drain')) return 'drainage';
    if (value.includes('electr')) return 'electricity';
    if (value.includes('water')) return 'water';
    if (value.includes('waste') || value.includes('garbage') || value.includes('trash')) return 'waste';
    if (value.includes('road') || value.includes('pothole')) return 'road';

    const allowed = ['road', 'water', 'electricity', 'waste', 'streetlight', 'drainage'];
    return allowed.find((cat) => value.includes(cat)) || '';
};

const normalizePriority = (rawValue) => {
    const value = String(rawValue || '').toLowerCase().trim();
    if (!value) return '';
    if (value.includes('urgent')) return 'urgent';
    if (value.includes('high')) return 'high';
    if (value.includes('medium')) return 'medium';
    if (value.includes('low')) return 'low';
    return '';
};

const buildFallbackTitle = (description) => {
    const compact = String(description || '').trim().replace(/\s+/g, ' ');
    if (!compact) return 'Issue Report';
    return compact.split(' ').slice(0, 8).join(' ');
};

const cleanText = (value) => String(value || '').trim().replace(/^['"]|['"]$/g, '');
const getFileSignature = (file) => `${file.name}-${file.size}-${file.lastModified}`;

const pickAISuggestionFields = (responseData) => {
    const payload = responseData && typeof responseData === 'object' && responseData.data && typeof responseData.data === 'object'
        ? responseData.data
        : responseData;

    const source = payload && typeof payload === 'object' ? payload : {};
    const aiSuggestions = source.aiSuggestions && typeof source.aiSuggestions === 'object' ? source.aiSuggestions : {};
    const issueNode = source.issue && typeof source.issue === 'object' ? source.issue : {};

    return {
        title: cleanText(
            aiSuggestions.suggestedTitle ||
            source.suggestedTitle ||
            source.generatedTitle ||
            source.title ||
            issueNode.title ||
            ''
        ),
        category: cleanText(
            aiSuggestions.suggestedCategory ||
            source.suggestedCategory ||
            source.category ||
            source.type ||
            issueNode.category ||
            ''
        ),
        priority: cleanText(
            aiSuggestions.suggestedPriority ||
            source.suggestedPriority ||
            source.priority ||
            source.urgency ||
            issueNode.priority ||
            ''
        )
    };
};

const CreateIssue = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [aiPreview, setAiPreview] = useState(null);
    const [useAIOnSubmit, setUseAIOnSubmit] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'road',
        priority: 'medium',
        location: {
            type: 'Point',
            coordinates: [79.8612, 6.9271]
        }
    });

    const [images, setImages] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (!images.length) {
            setImagePreviews([]);
            return;
        }

        const previews = images.map((file) => ({
            name: file.name,
            signature: getFileSignature(file),
            url: URL.createObjectURL(file)
        }));

        setImagePreviews(previews);

        return () => {
            previews.forEach((item) => URL.revokeObjectURL(item.url));
        };
    }, [images]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAISuggest = async () => {
        const descriptionToAnalyze = aiPrompt.trim();
        if (!descriptionToAnalyze) {
            setAiError('Enter the issue in the AI box first.');
            return;
        }

        setAiError('');
        setAiLoading(true);
        setUseAIOnSubmit(false);
        setAiPreview(null);

        try {
            const response = await suggestIssueDetails(descriptionToAnalyze);
            const suggestion = pickAISuggestionFields(response);

            const resolvedTitle = suggestion.title.trim() || formData.title || buildFallbackTitle(descriptionToAnalyze);
            const resolvedCategory = normalizeCategory(suggestion.category) || formData.category;
            const resolvedPriority = normalizePriority(suggestion.priority) || formData.priority;

            setFormData((prev) => ({
                ...prev,
                title: resolvedTitle,
                description: descriptionToAnalyze,
                category: resolvedCategory,
                priority: resolvedPriority
            }));

            setAiPreview({
                title: resolvedTitle,
                category: resolvedCategory,
                priority: resolvedPriority
            });
        } catch (err) {
            if (err.code === 'AI_SUGGEST_ENDPOINT_NOT_FOUND') {
                const fallbackTitle = formData.title || buildFallbackTitle(descriptionToAnalyze);
                const fallbackCategory = normalizeCategory(descriptionToAnalyze) || formData.category;
                const fallbackPriority = normalizePriority(descriptionToAnalyze) || formData.priority;

                setUseAIOnSubmit(true);
                setFormData((prev) => ({
                    ...prev,
                    description: descriptionToAnalyze,
                    title: fallbackTitle,
                    category: fallbackCategory,
                    priority: fallbackPriority
                }));
                setAiPreview({
                    title: fallbackTitle,
                    category: fallbackCategory,
                    priority: fallbackPriority
                });
                setAiError('AI preview endpoint is not available. Description is copied, and final AI enrichment will run when submitting.');
            } else {
                setAiError(err.response?.data?.message || 'AI suggestion failed. Please try again.');
            }
        } finally {
            setAiLoading(false);
        }
    };

    const handleLocationChange = (loc) => {
        // ensure coordinates order: [lng, lat] and numbers where possible
        const lng = loc.coordinates && loc.coordinates[0] != null ? Number(loc.coordinates[0]) : null;
        const lat = loc.coordinates && loc.coordinates[1] != null ? Number(loc.coordinates[1]) : null;
        const normalized = { type: 'Point', coordinates: [lng, lat] };
        if (loc.address) normalized.address = loc.address;
        setFormData((prev) => ({ ...prev, location: normalized }));
    };

    const handleFilesChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        setImages((prev) => {
            const merged = [...prev, ...files];
            const uniqueBySignature = new Map();

            merged.forEach((file) => {
                uniqueBySignature.set(getFileSignature(file), file);
            });

            return Array.from(uniqueBySignature.values());
        });

        // Reset input so selecting the same file again still triggers onChange
        e.target.value = '';
    };

    const handleRemoveImage = (signatureToRemove) => {
        setImages((prev) => prev.filter((file) => getFileSignature(file) !== signatureToRemove));
    };

    const handleClearImages = () => {
        setImages([]);
    };

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const location = formData.location;
            const lng = location?.coordinates?.[0];
            const lat = location?.coordinates?.[1];
            const latNum = Number(lat);
            const lngNum = Number(lng);

            if (
                lng == null ||
                lat == null ||
                Number.isNaN(lngNum) ||
                Number.isNaN(latNum) ||
                latNum < -90 ||
                latNum > 90 ||
                lngNum < -180 ||
                lngNum > 180
            ) {
                setError('Please provide valid location coordinates before submitting.');
                setLoading(false);
                return;
            }

            // Build payload
            const basePayload = {
                title: formData.title,
                description: (formData.description || aiPrompt || '').trim(),
                category: formData.category,
                priority: formData.priority,
                location: {
                    type: 'Point',
                    coordinates: [lngNum, latNum]
                },
                useAI: useAIOnSubmit
            };
            if (formData.location.address) basePayload.location.address = formData.location.address;

            if (images && images.length > 0) {
                const fd = new FormData();
                // append images under field name 'images'
                images.forEach((file) => fd.append('images', file));
                // append other fields
                fd.append('title', basePayload.title);
                fd.append('description', basePayload.description);
                fd.append('category', basePayload.category);
                fd.append('priority', basePayload.priority);
                fd.append('location', JSON.stringify(basePayload.location));
                fd.append('useAI', basePayload.useAI ? 'true' : 'false');

                await createIssue(fd);
            } else {
                // send application/json with location as object
                await createIssue(basePayload);
            }

            showToast('success', 'Issue submitted successfully');
            // reset
            setFormData({
                title: '',
                description: '',
                category: 'road',
                priority: 'medium',
                location: { type: 'Point', coordinates: [null, null] }
            });
            setImages([]);
            navigate('/issues');
        } catch (err) {
            setError(err.message || 'Failed to report issue.');
            showToast('error', err.message || 'Failed to report issue.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-issue-container animate-fade-in">
            <h1 className="page-title">Report New Issue</h1>

            <div className="ai-assist-card">
                <div className="ai-assist-header">
                    <div className="ai-assist-title">
                        <Sparkles size={16} /> AI Assistant
                    </div>
                    <p>Describe the issue naturally. AI will auto-fill title, category, and priority.</p>
                </div>

                <textarea
                    className="input-field ai-chat-box"
                    rows="4"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Example: There is a deep pothole near the school entrance causing traffic and accidents."
                />

                <div className="ai-actions">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setAiPrompt(formData.description || '')}
                        disabled={aiLoading}
                    >
                        Use Form Description
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleAISuggest}
                        disabled={aiLoading}
                    >
                        {aiLoading ? 'Analyzing...' : 'Analyze & Autofill'}
                    </button>
                </div>

                {aiError && <div className="auth-error ai-error-box">{aiError}</div>}

                {useAIOnSubmit && (
                    <div className="ai-submit-hint">
                        Backend will apply AI on submit (`useAI: true`) because preview routes are unavailable.
                    </div>
                )}

                {aiPreview && (
                    <div className="ai-preview-grid">
                        <div className="ai-preview-item">
                            <span>Title</span>
                            <strong>{aiPreview.title}</strong>
                        </div>
                        <div className="ai-preview-item">
                            <span>Category</span>
                            <strong>{aiPreview.category}</strong>
                        </div>
                        <div className="ai-preview-item">
                            <span>Priority</span>
                            <strong>{aiPreview.priority}</strong>
                        </div>
                    </div>
                )}
            </div>

            <div className="card create-issue-card">
                {error && <div className="auth-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Issue Title</label>
                        <input
                            className="input-field"
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            className="input-field"
                            name="description"
                            rows="4"
                            value={formData.description}
                            onChange={handleChange}
                            required
                        ></textarea>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Category</label>
                        <select className="input-field" name="category" value={formData.category} onChange={handleChange}>
                            {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Priority</label>
                        <select className="input-field" name="priority" value={formData.priority} onChange={handleChange}>
                            {PRIORITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="card">
                        <label className="form-label">Location</label>
                        <LocationStep value={formData.location} onChange={handleLocationChange} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Images (optional)</label>
                        <input type="file" accept="image/*" multiple onChange={handleFilesChange} />
                        {images.length > 0 && (
                            <div className="upload-selection-summary">
                                <span>{images.length} image{images.length > 1 ? 's' : ''} selected</span>
                                <button type="button" className="upload-clear-btn" onClick={handleClearImages}>Clear all</button>
                            </div>
                        )}
                        {imagePreviews.length > 0 && (
                            <div className="issue-upload-preview-grid">
                                {imagePreviews.map((item, index) => (
                                    <div className="issue-upload-preview-card" key={item.signature}>
                                        <img
                                            src={item.url}
                                            alt={`Selected upload ${index + 1}`}
                                            className="issue-upload-preview-image"
                                            loading="lazy"
                                        />
                                        <div className="issue-upload-preview-footer">
                                            <div className="issue-upload-preview-name" title={item.name}>{item.name}</div>
                                            <button
                                                type="button"
                                                className="upload-remove-btn"
                                                onClick={() => handleRemoveImage(item.signature)}
                                                aria-label={`Remove ${item.name}`}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn-primary w-full" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit Report'}
                    </button>
                </form>
            </div>
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default CreateIssue;
