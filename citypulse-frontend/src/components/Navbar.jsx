import React from 'react';
import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
    return (
        <header className="navbar">
            <div className="navbar-search">
                {/* Placeholder for future search functionality */}
            </div>
            <div className="navbar-actions">
                <div className="user-profile">
                    <div className="avatar">
                        <User size={20} />
                    </div>
                    <div className="user-info">
                        <span className="user-name">Welcome Back</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
