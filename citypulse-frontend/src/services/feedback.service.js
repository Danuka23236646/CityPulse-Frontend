import api from './api';

export const getFeedback = async () => {
    const response = await api.get('/feedback');
    return response.data;
};

export const getMyFeedback = async () => {
    const response = await api.get('/feedback/me');
    return response.data;
};

export const submitFeedback = async (issueId, feedbackData) => {
    const response = await api.post(`/feedback/${issueId}`, feedbackData);
    return response.data;
};

export const updateFeedback = async (feedbackId, feedbackData) => {
    const response = await api.put(`/feedback/${feedbackId}`, feedbackData);
    return response.data;
};

export const replyToFeedback = async (feedbackId, payload) => {
    const response = await api.post(`/feedback/${feedbackId}/reply`, payload);
    return response.data;
};

export const deleteFeedback = async (feedbackId) => {
    const response = await api.delete(`/feedback/${feedbackId}`);
    return response.data;
};
