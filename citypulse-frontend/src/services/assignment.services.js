import api from './api';

export const getMyAssignments = async () => {
    const response = await api.get('/assignments/me');
    return response.data;
};

// Backward-compatible alias used by older pages.
export const getAssignments = getMyAssignments;

export const getAssignmentsByOfficer = async (officerId) => {
    const response = await api.get(`/assignments/officer/${officerId}`);
    return response.data;
};

export const acceptAssignment = async (id) => {
    const response = await api.put(`/assignments/${id}/accept`, {});
    return response.data;
};

export const completeAssignment = async (id) => {
    const response = await api.put(`/assignments/${id}/complete`, {});
    return response.data;
};

export const deleteAssignment = async (assignmentId) => {
    const response = await api.delete(`/assignments/${assignmentId}`);
    return response.data;
};