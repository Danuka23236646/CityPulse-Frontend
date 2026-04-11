import React, { useEffect, useState } from 'react';
import { getProfile } from '../services/auth.service';
import { User, MapPin, Phone, Mail, Award } from 'lucide-react';

const Profile = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await getProfile();
            setProfile(res.data?.user || res.data || JSON.parse(localStorage.getItem('user')));
        } catch (err) {
            // Fallback to local storage
            setProfile(JSON.parse(localStorage.getItem('user')));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="animate-fade-in">Loading profile...</div>;
    if (!profile) return <div className="animate-fade-in">Failed to load profile.</div>;

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="page-title">My Profile</h1>

            <div className="card d-flex gap-4" style={{ padding: '2.5rem' }}>
                <div style={{ flexShrink: 0 }}>
                    <div
                        className="avatar"
                        style={{
                            width: '120px',
                            height: '120px',
                            fontSize: '3rem',
                            background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                            color: 'white',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'var(--shadow-md)'
                        }}
                    >
                        {profile.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                </div>

                <div style={{ flexGrow: 1 }}>
                    <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{profile.name}</h2>
                    <p className="text-muted d-flex align-center gap-2 mb-4">
                        <Award size={18} /> Role: <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{profile.role}</span>
                    </p>

                    <div className="grid grid-cols-2" style={{ gap: '1.5rem', marginTop: '2rem' }}>
                        <div>
                            <h4 className="text-muted mb-2 d-flex align-center gap-2"><Mail size={16} /> Email</h4>
                            <p style={{ fontWeight: '500' }}>{profile.email}</p>
                        </div>
                        <div>
                            <h4 className="text-muted mb-2 d-flex align-center gap-2"><Phone size={16} /> Phone</h4>
                            <p style={{ fontWeight: '500' }}>{profile.phone || 'Not provided'}</p>
                        </div>
                        <div>
                            <h4 className="text-muted mb-2 d-flex align-center gap-2"><MapPin size={16} /> Location / Address</h4>
                            <p style={{ fontWeight: '500' }}>{profile.address || profile.location || 'Not provided'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card mt-4">
                <h3 className="mb-4">Account Settings</h3>
                <p className="text-muted mb-4">Update your profile information and preferences.</p>
                <div className="d-flex gap-3">
                    <button className="btn-primary" disabled>Edit Profile (Coming Soon)</button>
                    <button className="btn-secondary" disabled>Change Password</button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
