import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function RegisterPage() {
    const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirm) return toast.error('Passwords do not match');
        if (form.password.length < 6) return toast.error('Password must be at least 6 characters');

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/register`, {
                username: form.username,
                email: form.email,
                password: form.password
            }, { validateStatus: () => true });

            if (res.data.token) {
                toast.success('Account created successfully!');
                navigate('/login');
            } else {
                toast.error(res.data.error || 'Registration failed');
            }
        } catch {
            toast.error('Network error — is the server running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div style={{ maxWidth: 460, width: '100%' }}>
                <div className="glass-card" style={{ padding: '48px 40px' }}>
                    <div className="login-form-header">
                        <div className="login-form-title">CREATE ACCOUNT</div>
                        <div className="login-form-sub">Join AuthKavach's protected ecosystem</div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="input-label">Username</label>
                            <input className="input-field" type="text" name="username" value={form.username} onChange={handleChange} placeholder="Choose a username" required />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Email Address</label>
                            <input className="input-field" type="email" name="email" value={form.email} onChange={handleChange} placeholder="your@email.com" required />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Password</label>
                            <input className="input-field" type="password" name="password" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" required />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Confirm Password</label>
                            <input className="input-field" type="password" name="confirm" value={form.confirm} onChange={handleChange} placeholder="Repeat password" required />
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 52, fontSize: 15, letterSpacing: 2 }} disabled={loading}>
                            {loading ? <span className="loading-spinner" /> : '→ CREATE ACCOUNT'}
                        </button>
                    </form>

                    <div className="form-footer">
                        Already have an account? <Link to="/login">Login here</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
