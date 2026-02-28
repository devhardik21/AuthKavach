import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthSuccessPage() {
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(10);
    const [scanProgress, setScanProgress] = useState(0);
    const [checks, setChecks] = useState([
        { label: 'Identity Verified', done: false },
        { label: 'Token Issued', done: false },
        { label: 'Session Established', done: false },
        { label: 'Security Audit Logged', done: false },
        { label: 'ML Threat Model Updated', done: false },
    ]);
    const username = localStorage.getItem('auth_username') || 'User';

    // Animate reveal of checks one by one
    useEffect(() => {
        const timers = checks.map((_, i) =>
            setTimeout(() => {
                setChecks(prev =>
                    prev.map((c, idx) => idx === i ? { ...c, done: true } : c)
                );
            }, 400 + i * 500)
        );
        return () => timers.forEach(clearTimeout);
    }, []);

    // Animate scan bar
    useEffect(() => {
        const start = Date.now();
        const duration = 2500;
        const frame = () => {
            const elapsed = Date.now() - start;
            const pct = Math.min((elapsed / duration) * 100, 100);
            setScanProgress(pct);
            if (pct < 100) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }, []);

    return (
        <div className="auth-success-page">
            {/* Animated radial glow behind the card */}
            <div className="auth-success-glow" />

            <div className="auth-success-card glass-card">
                {/* Header */}
                <div className="auth-success-header">
                    <div className="auth-success-shield">
                        <div className="shield-ring" />
                        <div className="shield-ring ring2" />
                        <span className="shield-icon">🛡️</span>
                    </div>
                    <div className="auth-success-tag">
                        <span className="auth-dot" />
                        AUTHENTICATION SUCCESSFUL
                    </div>
                    <h1 className="auth-success-title">
                        ACCESS <span>GRANTED</span>
                    </h1>
                    <p className="auth-success-sub">
                        Welcome back, <strong style={{ color: 'var(--neon-green)' }}>{username}</strong>.
                        AuthKavach has verified your identity and cleared all security checks.
                    </p>
                </div>

                {/* Scan progress bar */}
                <div className="auth-scan-bar-wrap">
                    <div className="auth-scan-bar-label">
                        <span>Security Scan</span>
                        <span style={{ color: 'var(--neon-green)' }}>{Math.round(scanProgress)}%</span>
                    </div>
                    <div className="auth-scan-bar-track">
                        <div
                            className="auth-scan-bar-fill"
                            style={{ width: `${scanProgress}%` }}
                        />
                    </div>
                </div>

                {/* Checklist */}
                <div className="auth-checks">
                    {checks.map((c, i) => (
                        <div key={i} className={`auth-check-item ${c.done ? 'done' : ''}`}>
                            <span className="auth-check-icon">
                                {c.done ? '✓' : <span className="check-spinner" />}
                            </span>
                            <span className="auth-check-label">{c.label}</span>
                        </div>
                    ))}
                </div>

                {/* ML result detail panel */}
                <div className="auth-ml-panel">
                    <div className="auth-ml-panel-label">ML Risk Assessment</div>
                    <div className="auth-ml-stats">
                        <div className="auth-ml-stat">
                            <span className="auth-ml-stat-val" style={{ color: 'var(--neon-green)' }}>
                                {localStorage.getItem('last_risk_score') || '—'}
                            </span>
                            <span className="auth-ml-stat-key">Hybrid Risk Score</span>
                        </div>
                        <div style={{ width: 1, background: 'rgba(0,255,65,0.1)' }} />
                        <div className="auth-ml-stat">
                            <span className="auth-ml-stat-val" style={{ color: 'var(--neon-green)' }}>ALLOW</span>
                            <span className="auth-ml-stat-key">Decision</span>
                        </div>
                        <div style={{ width: 1, background: 'rgba(0,255,65,0.1)' }} />
                        <div className="auth-ml-stat">
                            <span className="auth-ml-stat-val" style={{ color: 'var(--neon-blue)' }}>CLEAN</span>
                            <span className="auth-ml-stat-key">Anomaly Status</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="auth-success-actions">
                    <button
                        className="btn btn-ghost"
                        style={{ flex: 1, height: 50 }}
                        onClick={() => {
                            localStorage.removeItem('auth_token');
                            localStorage.removeItem('auth_username');
                            localStorage.removeItem('last_risk_score');
                            navigate('/login');
                        }}
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
