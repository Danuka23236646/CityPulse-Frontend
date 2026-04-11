import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || 'https://citypulse-backend-ni4s.onrender.com';
const BACKEND_BASE_URL = configuredBaseUrl.replace(/\/$/, '').replace(/\/api$/, '');
export const SOCKET_BASE_URL = BACKEND_BASE_URL;

const api = axios.create({
    baseURL: `${BACKEND_BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Add interceptor for JWT
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Handle unauthorized globally (e.g. redirect to login)
            localStorage.removeItem('token');
            // optionally redirect: window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
