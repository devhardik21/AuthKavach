import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
    const location = useLocation();

    return (
        <nav className="navbar">
            <Link to="/login" className="navbar-brand">
                <div className="navbar-logo">🛡️</div>
                <div>
                    <div className="navbar-title">AUTHKAVACH</div>
                    <div className="navbar-subtitle">ADAPTIVE SECURITY</div>
                </div>
            </Link>

            <div className="navbar-links">
                <Link
                    to="/login"
                    className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
                >
                    Login
                </Link>
                <Link
                    to="/register"
                    className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`}
                >
                    Register
                </Link>
            </div>
        </nav>
    );
}
