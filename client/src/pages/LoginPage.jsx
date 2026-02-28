import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function LoginPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: '', password: '', honeypot: '' });
    const [fingerprint, setFingerprint] = useState('');
    const [typingSpeed, setTypingSpeed] = useState(3.5);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { action, riskScore, ... }
    const [showOTPModal, setShowOTPModal] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);

    // Typing speed tracking
    const keyTimestampsRef = useRef([]);

    // Load FingerprintJS on mount
    useEffect(() => {
        (async () => {
            try {
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                setFingerprint(result.visitorId);
            } catch {
                setFingerprint('fp_unknown_' + Math.random().toString(36).slice(2));
            }
        })();
    }, []);

    const handleKeyDown = useCallback(() => {
        const now = Date.now();
        keyTimestampsRef.current.push(now);
        if (keyTimestampsRef.current.length > 10) {
            keyTimestampsRef.current.shift();
        }
        if (keyTimestampsRef.current.length > 2) {
            const timestamps = keyTimestampsRef.current;
            let totalGap = 0;
            for (let i = 1; i < timestamps.length; i++) {
                totalGap += timestamps[i] - timestamps[i - 1];
            }
            const avgGapMs = totalGap / (timestamps.length - 1);
            setTypingSpeed(parseFloat((avgGapMs / 1000).toFixed(3)));
        }
    }, []);

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        try {
            const payload = {
                username: form.username,
                password: form.password,
                fingerprint,
                honeypot: form.honeypot,
                typingSpeed
            };

            const res = await axios.post(`${API_URL}/api/auth/login`, payload, {
                validateStatus: () => true
            });

            const data = res.data;
            setResult(data);

            if (res.status === 403 || data.action === 'BLOCK') {
                toast.error(`🚫 Access Blocked! Risk Score: ${data.riskScore ?? '?'}`);
            } else if (data.action === 'CHALLENGE') {
                toast('🔐 Challenge Required — Check your email for OTP', {
                    icon: '⚠️',
                    style: { borderColor: 'rgba(255,140,0,0.5)' }
                });
                setShowOTPModal(true);
            } else if (data.action === 'ALLOW') {
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('auth_username', data.username);
                localStorage.setItem('last_risk_score', data.riskScore ?? '0');
                toast.success(`✅ Welcome, ${data.username}! Redirecting...`);
                setTimeout(() => navigate('/auth-success'), 800);
            } else {
                toast.error(data.error || 'Login failed');
            }
        } catch (err) {
            toast.error('Network error — is the server running?');
        } finally {
            setLoading(false);
        }
    };

    const handleOTPSubmit = async (e) => {
        e.preventDefault();
        setOtpLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/verify-otp`, {
                username: form.username,
                otp,
                password: form.password
            }, { validateStatus: () => true });

            if (res.data.token) {
                localStorage.setItem('auth_token', res.data.token);
                localStorage.setItem('auth_username', res.data.username);
                localStorage.setItem('last_risk_score', '0');
                toast.success(`✅ OTP verified! Welcome, ${res.data.username}!`);
                setShowOTPModal(false);
                setTimeout(() => navigate('/auth-success'), 800);
            } else {
                toast.error(res.data.error || 'Invalid OTP');
            }
        } catch {
            toast.error('OTP verification failed');
        } finally {
            setOtpLoading(false);
        }
    };

    const getRiskClass = () => {
        if (!result) return '';
        if (result.action === 'BLOCK') return 'block';
        if (result.action === 'CHALLENGE') return 'challenge';
        return 'allow';
    };

    const getRiskIcon = () => {
        if (!result) return '';
        if (result.action === 'BLOCK') return '🚫 ACCESS BLOCKED';
        if (result.action === 'CHALLENGE') return '⚠️ CHALLENGE REQUIRED';
        return '✅ ACCESS GRANTED';
    };

    return (
        <div className="login-page">
            <div className="login-container glass-card">
                {/* Hero Panel */}
                <div className="login-hero">
                    <div>
                        <div className="login-hero-tag">
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff41', display: 'inline-block' }}></span>
                            ADAPTIVE SECURITY
                        </div>
                        <div className="login-hero-title">
                            CYBER<br />
                            <span>DEFENSE</span><br />
                            THAT EVOLVES<br />
                            DAILY.
                        </div>
                        <p className="login-hero-desc">
                            AI-driven protection that learns, adapts, and grows stronger every single day — so you stay one step ahead of every digital threat.
                        </p>
                    </div>
                    {/* <div className="login-hero-stats">
                        <div>
                            <div className="hero-stat-num">1,600+</div>
                            <div className="hero-stat-label">Users Active</div>
                        </div>
                        <div style={{ width: 1, background: 'rgba(0,255,65,0.15)' }} />
                        <div>
                            <div className="hero-stat-num">300+</div>
                            <div className="hero-stat-label">Technologies</div>
                        </div>
                        <div style={{ width: 1, background: 'rgba(0,255,65,0.15)' }} />
                        <div>
                            <div className="hero-stat-num">99.8%</div>
                            <div className="hero-stat-label">Block Rate</div>
                        </div>
                    </div> */}
                </div>

                {/* Form Panel */}
                <div className="login-form-panel">
                    <div className="login-form-header">
                        <div className="login-form-title">SECURE LOGIN</div>
                        <div className="login-form-sub">Protected by AuthKavach ML detection engine</div>
                    </div>

                    {result && (
                        <div className={`risk-indicator ${getRiskClass()}`}>
                            <span>{getRiskIcon()}</span>
                            {result.riskScore !== undefined && (
                                <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: 11 }}>
                                    Risk: {result.riskScore}/100
                                </span>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Honeypot — hidden from real users */}
                        <input
                            className="honeypot-field"
                            type="text"
                            name="honeypot"
                            value={form.honeypot}
                            onChange={handleChange}
                            tabIndex="-1"
                            autoComplete="off"
                            aria-hidden="true"
                        />

                        <div className="input-group">
                            <label className="input-label">Username</label>
                            <input
                                className="input-field"
                                type="text"
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter username"
                                autoComplete="username"
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Password</label>
                            <input
                                className="input-field"
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter password"
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: 8, height: 52, fontSize: 15, letterSpacing: 2 }}
                            disabled={loading}
                        >
                            {loading ? <span className="loading-spinner" /> : '→ GET PROTECTED'}
                        </button>
                    </form>

                    <div className="form-footer">
                        Don't have an account?{' '}
                        <Link to="/register">Register here</Link>
                    </div>

                    <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(0,255,65,0.04)', borderRadius: 8, border: '1px solid rgba(0,255,65,0.08)' }}>
                        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Detection Signals</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                            <span>📱 Device: {fingerprint ? fingerprint.slice(0, 8) + '...' : 'Loading...'}</span>
                            <span>⌨️ Typing: {typingSpeed}s</span>
                            <span>🔒 Honeypot: Active</span>
                            <span>🛡️ ML Engine: Ready</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* OTP Modal */}
            {showOTPModal && (
                <div className="modal-overlay" onClick={() => setShowOTPModal(false)}>
                    <div className="modal-box glass-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-title">🔐 VERIFICATION REQUIRED</div>
                        <p className="modal-sub">
                            A one-time code has been sent to your registered email address.
                            In dev mode, check the server console for the OTP.
                        </p>
                        <form onSubmit={handleOTPSubmit}>
                            <div className="input-group">
                                <label className="input-label">Enter OTP Code</label>
                                <input
                                    className="input-field otp-input"
                                    type="text"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="••••••"
                                    maxLength={6}
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                disabled={otpLoading || otp.length !== 6}
                            >
                                {otpLoading ? <span className="loading-spinner" /> : 'Verify OTP'}
                            </button>
                            <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setShowOTPModal(false)}>
                                Cancel
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
