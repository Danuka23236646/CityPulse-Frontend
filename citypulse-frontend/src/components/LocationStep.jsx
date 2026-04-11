import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './LocationStep.css';

const isValidLatitude = (v) => typeof v === 'number' && !Number.isNaN(v) && v >= -90 && v <= 90;
const isValidLongitude = (v) => typeof v === 'number' && !Number.isNaN(v) && v >= -180 && v <= 180;

const DEFAULT_CENTER = { lat: 6.9271, lng: 79.8612 };

const MapClickHandler = ({ onPick }) => {
    useMapEvents({
        click: (event) => {
            onPick(event.latlng.lat, event.latlng.lng);
        }
    });
    return null;
};

const MapCenterController = ({ lat, lng }) => {
    const map = useMap();

    useEffect(() => {
        if (isValidLatitude(lat) && isValidLongitude(lng)) {
            map.setView([lat, lng], 16, { animate: true });
        }
    }, [lat, lng, map]);

    return null;
};

const LocationStep = ({ value, onChange }) => {
    // value: { type: 'Point', coordinates: [lng, lat], address }
    const initialLat = value && value.coordinates && value.coordinates[1] != null ? Number(value.coordinates[1]) : '';
    const initialLng = value && value.coordinates && value.coordinates[0] != null ? Number(value.coordinates[0]) : '';
    const initialAddress = value && value.address ? value.address : '';

    const [lat, setLat] = useState(initialLat);
    const [lng, setLng] = useState(initialLng);
    const [address, setAddress] = useState(initialAddress);

    const [geoLoading, setGeoLoading] = useState(false);
    const [geoError, setGeoError] = useState('');
    const [touched, setTouched] = useState({ lat: false, lng: false });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {
        // propagate value changes to parent as numbers when valid types
        const latNum = lat === '' ? null : Number(lat);
        const lngNum = lng === '' ? null : Number(lng);

        const loc = {
            type: 'Point',
            coordinates: [lngNum, latNum],
        };
        if (address && String(address).trim()) loc.address = String(address).trim();

        // Only call if onChange exists
        if (onChange) onChange(loc);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lat, lng, address]);

    const handleUseCurrent = () => {
        if (!navigator.geolocation) {
            setGeoError('Geolocation is not supported by your browser');
            return;
        }
        setGeoError('');
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const gotLat = position.coords.latitude;
                const gotLng = position.coords.longitude;
                setLat(Number(gotLat.toFixed(6)));
                setLng(Number(gotLng.toFixed(6)));
                setTouched({ lat: true, lng: true });
                setGeoLoading(false);
            },
            (err) => {
                if (err.code === 1) {
                    setGeoError('Location permission denied. Please enable location or enter coordinates manually.');
                } else {
                    setGeoError('Failed to get your location. Try again.');
                }
                setGeoLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const clear = () => {
        setLat('');
        setLng('');
        setAddress('');
        setGeoError('');
        setSearchError('');
        setSearchResults([]);
        setTouched({ lat: false, lng: false });
    };

    const handlePickFromMap = (pickedLat, pickedLng) => {
        setLat(Number(pickedLat.toFixed(6)));
        setLng(Number(pickedLng.toFixed(6)));
        setTouched({ lat: true, lng: true });
        setGeoError('');
    };

    const handleSearch = async () => {
        const q = searchQuery.trim();
        if (!q) {
            setSearchError('Enter a place name to search.');
            return;
        }

        setSearchError('');
        setSearchLoading(true);
        setSearchResults([]);

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Search request failed');
            }

            const results = await response.json();
            if (!Array.isArray(results) || results.length === 0) {
                setSearchError('No matching location found. Try a different keyword.');
                return;
            }

            setSearchResults(results);
        } catch (err) {
            setSearchError(err.message || 'Location search failed. Please try again.');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectResult = (result) => {
        const pickedLat = Number(result.lat);
        const pickedLng = Number(result.lon);
        setLat(Number(pickedLat.toFixed(6)));
        setLng(Number(pickedLng.toFixed(6)));
        setTouched({ lat: true, lng: true });
        setAddress(result.display_name || address);
        setSearchResults([]);
        setSearchError('');
    };

    const latNumber = lat === '' ? NaN : Number(lat);
    const lngNumber = lng === '' ? NaN : Number(lng);

    const latValid = isValidLatitude(latNumber);
    const lngValid = isValidLongitude(lngNumber);

    const mapCenter = useMemo(() => {
        if (latValid && lngValid) {
            return [latNumber, lngNumber];
        }
        return [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
    }, [latNumber, lngNumber, latValid, lngValid]);

    return (
        <div className="location-step">
            <div className="location-actions">
                <button type="button" className="btn-secondary small" onClick={handleUseCurrent} disabled={geoLoading}>
                    {geoLoading ? 'Locating...' : 'Use my current location'}
                </button>
                <button type="button" className="btn-ghost small" onClick={clear}>Clear</button>
            </div>

            {geoError && <div className="field-error">{geoError}</div>}

            <div className="location-search">
                <input
                    className="input-field"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearch();
                        }
                    }}
                    placeholder="Search and pin location (e.g. Galle Face Green)"
                />
                <button type="button" className="btn-secondary small" onClick={handleSearch} disabled={searchLoading}>
                    {searchLoading ? 'Searching...' : 'Search'}
                </button>
            </div>

            {searchError && <div className="field-error">{searchError}</div>}

            {searchResults.length > 0 && (
                <ul className="search-results-list">
                    {searchResults.map((item) => (
                        <li key={`${item.place_id}-${item.lat}-${item.lon}`}>
                            <button
                                type="button"
                                className="search-result-btn"
                                onClick={() => handleSelectResult(item)}
                            >
                                {item.display_name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="location-map-wrap">
                <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="location-map">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onPick={handlePickFromMap} />
                    <MapCenterController lat={latNumber} lng={lngNumber} />
                    {latValid && lngValid && (
                        <CircleMarker center={[latNumber, lngNumber]} radius={10} pathOptions={{ color: '#3b82f6' }} />
                    )}
                </MapContainer>
                <p className="map-hint">Tap or click on the map to pin location.</p>
            </div>

            <div className="location-grid">
                <div className="coord-field">
                    <label className="form-label">Latitude</label>
                    <input
                        className="input-field"
                        type="number"
                        name="latitude"
                        step="0.000001"
                        value={lat}
                        onChange={(e) => {
                            setLat(e.target.value === '' ? '' : Number(e.target.value));
                            setTouched((t) => ({ ...t, lat: true }));
                        }}
                        placeholder="e.g. 6.9271"
                    />
                </div>

                <div className="coord-field">
                    <label className="form-label">Longitude</label>
                    <input
                        className="input-field"
                        type="number"
                        name="longitude"
                        step="0.000001"
                        value={lng}
                        onChange={(e) => {
                            setLng(e.target.value === '' ? '' : Number(e.target.value));
                            setTouched((t) => ({ ...t, lng: true }));
                        }}
                        placeholder="e.g. 79.8612"
                    />
                </div>
            </div>

            <div className="validation-row">
                {!latValid && touched.lat && (
                    <div className="field-error">Latitude must be a number between -90 and 90.</div>
                )}
                {!lngValid && touched.lng && (
                    <div className="field-error">Longitude must be a number between -180 and 180.</div>
                )}
            </div>

            <div className="form-group">
                <label className="form-label">Address (optional)</label>
                <input
                    className="input-field"
                    type="text"
                    name="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Optional address or landmark"
                />
            </div>

            <div className="location-preview">
                <strong>Preview:</strong>
                <div>
                    Coordinates: [lng: {Number.isNaN(lngNumber) ? '-' : lngNumber}, lat: {Number.isNaN(latNumber) ? '-' : latNumber}]
                </div>
                {address && <div>Address: {address}</div>}
            </div>
        </div>
    );
};

export default LocationStep;