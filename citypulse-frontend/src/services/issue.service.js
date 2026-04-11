import api from './api';

export const getIssues = async (params = {}) => {
    const response = await api.get('/issues', { params });
    return response.data;
};

export const getIssueById = async (id) => {
    const response = await api.get(`/issues/${id}`);
    return response.data;
};

export const deleteIssue = async (issueId) => {
    const response = await api.delete(`/issues/${issueId}`);
    return response.data;
};

// Normalizes backend error messages into user-friendly messages
const normalizeError = (err) => {
    if (!err) return new Error('Request failed');
    const backendMsg = err.response?.data?.message || err.message || '';

    if (backendMsg.includes('Invalid location format')) {
        return new Error('The location format is invalid. Please provide valid latitude and longitude.');
    }
    if (backendMsg.includes('Location coordinates are required')) {
        return new Error('Please provide location coordinates (latitude and longitude).');
    }

    return new Error(backendMsg || 'Request failed');
};

export const createIssue = async (issueData) => {
    try {
        // If issueData is FormData, ensure fields are appended correctly by caller
        if (issueData instanceof FormData) {
            const response = await api.post('/issues', issueData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        }

        // JSON submission: validate minimal shape
        if (!issueData.location || !issueData.location.coordinates) {
            throw new Error('Location coordinates are required');
        }

        const response = await api.post('/issues', issueData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (err) {
        throw normalizeError(err);
    }
};

export const suggestIssueDetails = async (description) => {
    const response = await api.post('/issues/ai-suggest', { description });
    return response.data;
};

export const updateIssueStatus = async (id, status) => {
    const response = await api.put(`/issues/${id}`, { status });
    return response.data;
};

export const assignIssue = async (issueId, assignmentData) => {
    const response = await api.post(`/assignments/${issueId}`, assignmentData);
    return response.data;
};

export const reassignIssue = async (assignmentId, payload) => {
    const response = await api.put(`/assignments/${assignmentId}/reassign`, payload);
    return response.data;
};

export const getOfficers = async () => {
    const response = await api.get('/users/officers');
    return response.data;
};
