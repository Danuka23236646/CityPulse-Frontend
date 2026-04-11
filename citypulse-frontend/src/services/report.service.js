import api from './api';
import { formatSriLankaDate, formatSriLankaDateTime } from '../utils/dateTime';

const REPORT_TIME_ZONE = 'Asia/Colombo';
const REPORT_LOCALE = 'en-LK';
const REPORT_UTC_OFFSET_MINUTES = 330;

const getReportTimeOptions = () => ({
    params: {
        timezone: REPORT_TIME_ZONE,
        timeZone: REPORT_TIME_ZONE,
        tz: REPORT_TIME_ZONE,
        locale: REPORT_LOCALE,
        lang: REPORT_LOCALE,
        utcOffsetMinutes: REPORT_UTC_OFFSET_MINUTES,
        _ts: Date.now(),
    },
    headers: {
        'X-Timezone': REPORT_TIME_ZONE,
        'X-Time-Zone': REPORT_TIME_ZONE,
        'Timezone': REPORT_TIME_ZONE,
        'X-Locale': REPORT_LOCALE,
        'Accept-Language': REPORT_LOCALE,
        'X-UTC-Offset-Minutes': String(REPORT_UTC_OFFSET_MINUTES),
    },
});

const reportService = {
    // Get general dashboard stats
    getAdminDashboard: async () => {
        const res = await api.get('/reports/dashboard/admin');
        return res.data;
    },

    // CRUD Operations for Report Configurations
    getReports: async () => {
        const res = await api.get('/reports');
        return res.data;
    },

    getReportById: async (id) => {
        const res = await api.get(`/reports/${id}`);
        return res.data;
    },

    createReport: async (reportData) => {
        const res = await api.post('/reports', reportData);
        return res.data;
    },

    updateReport: async (id, reportData) => {
        const res = await api.put(`/reports/${id}`, reportData);
        return res.data;
    },

    deleteReport: async (id) => {
        const res = await api.delete(`/reports/${id}`);
        return res.data;
    },

    toggleReport: async (id) => {
        const res = await api.patch(`/reports/${id}/toggle`);
        return res.data;
    },

    // Execution & Downloads
    runReport: async (id) => {
        const res = await api.get(`/reports/${id}/run`, getReportTimeOptions());
        return res.data;
    },

    // Download specific report PDF
    downloadReportPdf: async (id, title) => {
        const response = await api.get(`/reports/${id}/download`, {
            ...getReportTimeOptions(),
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const timestamp = formatSriLankaDateTime(new Date(), {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).replace(/[\s/:,.]/g, '-');
        link.setAttribute('download', `Report_${title.replace(/\s+/g, '_')}_${timestamp}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    // Download general summary PDF
    downloadSummaryPdf: async () => {
        const response = await api.get('/reports/download-summary', {
            ...getReportTimeOptions(),
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const formattedDate = formatSriLankaDate(new Date(), {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).replace(/[/.]/g, '-');
        link.setAttribute('download', `CityPulse_Summary_${formattedDate}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
};

export default reportService;
