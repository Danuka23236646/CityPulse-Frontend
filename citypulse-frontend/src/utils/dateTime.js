export const SRI_LANKA_TIME_ZONE = 'Asia/Colombo';

const DEFAULT_LOCALE = 'en-LK';

const toDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatSriLankaDate = (value, options = {}, locale = DEFAULT_LOCALE) => {
    const date = toDate(value);
    if (!date) return '-';

    return date.toLocaleDateString(locale, {
        timeZone: SRI_LANKA_TIME_ZONE,
        ...options,
    });
};

export const formatSriLankaDateTime = (value, options = {}, locale = DEFAULT_LOCALE) => {
    const date = toDate(value);
    if (!date) return '-';

    return date.toLocaleString(locale, {
        timeZone: SRI_LANKA_TIME_ZONE,
        ...options,
    });
};