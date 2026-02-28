import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

const NEON = '#00ff41';
const NEON_RED = '#ff3b3b';
const NEON_ORANGE = '#ff8c00';
const NEON_BLUE = '#00d4ff';

const tooltipStyle = {
    contentStyle: {
        background: 'rgba(8,13,8,0.95)',
        border: '1px solid rgba(0,255,65,0.2)',
        borderRadius: 8,
        color: '#e8f5e9',
        fontFamily: "'Space Grotesk', monospace",
        fontSize: 12
    },
    labelStyle: { color: '#00ff41' }
};

// ─── Stat Card ────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accentColor = NEON }) {
    return (
        <div className="glass-card stat-card" style={{ '--accent-color': accentColor }}>
            <div className="stat-icon" style={{ border: `1px solid ${accentColor}30`, color: accentColor }}>
                {icon}
            </div>
            <div className="stat-number" style={{ color: accentColor }}>{value}</div>
            <div className="stat-label">{label}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    );
}

// ─── Alert Feed ───────────────────────────────────────────────────
function AlertFeed({ alerts }) {
    return (
        <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="section-title">Live Threat Feed</div>
            <div className="alert-feed" style={{ padding: '12px 16px', flex: 1 }}>
                {alerts.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px', fontSize: 13 }}>
                        No alerts yet. Start the attack simulator to see live alerts.
                    </div>
                )}
                {alerts.map((alert, i) => (
                    <div key={i} className={`alert-item ${alert.type}`}>
                        <span className="alert-icon">
                            {alert.type === 'BLOCKED' ? '🚫' : alert.type === 'CHALLENGE' ? '⚠️' : '✅'}
                        </span>
                        <div className="alert-content">
                            <div className="alert-title">
                                {alert.type === 'BLOCKED' ? 'Attack Blocked' :
                                    alert.type === 'CHALLENGE' ? 'Challenge Issued' : 'Login Success'}
                                {' '}
                                <span className={`badge badge-${alert.type === 'BLOCKED' ? 'block' : alert.type === 'CHALLENGE' ? 'challenge' : 'allow'}`}>
                                    Risk: {alert.riskScore ?? '?'}
                                </span>
                            </div>
                            <div className="alert-meta">
                                IP: {alert.ip} | User: {alert.username} | {new Date(alert.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Threshold Panel ──────────────────────────────────────────────
function ThresholdPanel({ thresholds, onUpdate }) {
    const [local, setLocal] = useState(thresholds);

    useEffect(() => setLocal(thresholds), [thresholds]);

    const handleChange = (key, val) => {
        const updated = { ...local, [key]: Number(val) };
        setLocal(updated);
    };

    const handleSave = async () => {
        try {
            await axios.post(`${API_URL}/api/admin/thresholds`, local);
            onUpdate(local);
            toast.success('Thresholds updated!');
        } catch {
            toast.error('Failed to update thresholds');
        }
    };

    const sliders = [
        { key: 'velocity_high', label: 'Velocity Alert Threshold (req/min)', min: 1, max: 30 },
        { key: 'velocity_block', label: 'Velocity Hard Block (req/min)', min: 5, max: 60 },
        { key: 'abuse_ip', label: 'AbuseIPDB Score Threshold', min: 0, max: 100 },
        { key: 'unique_accounts_high', label: 'Unique Accounts / IP Alert', min: 1, max: 20 },
        { key: 'risk_block', label: 'Risk Score → BLOCK', min: 50, max: 100 },
        { key: 'risk_challenge', label: 'Risk Score → CHALLENGE', min: 10, max: 70 },
    ];

    return (
        <div className="glass-card" style={{ padding: 0 }}>
            <div className="section-title">Threshold Sliders</div>
            <div style={{ padding: '16px 24px' }}>
                {sliders.map(s => (
                    <div className="slider-row" key={s.key}>
                        <span className="slider-label">{s.label}</span>
                        <input
                            type="range"
                            min={s.min}
                            max={s.max}
                            value={local[s.key] ?? s.min}
                            onChange={e => handleChange(s.key, e.target.value)}
                        />
                        <span className="slider-value">{local[s.key]}</span>
                    </div>
                ))}
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={handleSave}>
                    Save Thresholds
                </button>
            </div>
        </div>
    );
}

// ─── Feature Radar ────────────────────────────────────────────────
function FeatureRadar({ logs }) {
    const recentAttacks = logs.filter(l => l.action === 'BLOCK').slice(0, 20);
    if (recentAttacks.length === 0) return null;

    const avg = (arr, key) => {
        const nums = arr.map(x => x[key] || 0);
        return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
    };

    const data = [
        { feature: 'Velocity', value: Math.min(avg(recentAttacks, 'attempts_per_min') * 5, 100) },
        { feature: 'Fail Ratio', value: Math.round(avg(recentAttacks, 'fail_ratio') * 100) },
        { feature: 'Uniq Accts', value: Math.min(avg(recentAttacks, 'unique_accounts') * 10, 100) },
        { feature: 'Dev Change', value: avg(recentAttacks, 'device_change') * 100 },
        { feature: 'Geo Anomaly', value: avg(recentAttacks, 'geo_anomaly') * 100 },
        { feature: 'Honeypot', value: avg(recentAttacks, 'honeypot') * 100 },
    ];

    return (
        <div className="glass-card chart-wrapper">
            <div className="chart-title">Attack Feature Breakdown</div>
            <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={data}>
                    <PolarGrid stroke="rgba(0,255,65,0.1)" />
                    <PolarAngleAxis dataKey="feature" tick={{ fill: '#7caa7c', fontSize: 11 }} />
                    <Radar dataKey="value" stroke={NEON} fill={NEON} fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Recent Logs Table ────────────────────────────────────────────
function RecentLogsTable({ logs }) {
    return (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Recent Activity</div>
            <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>IP</th>
                            <th>User</th>
                            <th>Action</th>
                            <th>Risk</th>
                            <th>Honeypot</th>
                            <th>Velocity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.slice(0, 30).map((log, i) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </td>
                                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.ip}</td>
                                <td>{log.username}</td>
                                <td>
                                    <span className={`badge badge-${log.action?.toLowerCase()}`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td>
                                    <span style={{
                                        color: log.hybridRiskScore >= 70 ? NEON_RED :
                                            log.hybridRiskScore >= 30 ? NEON_ORANGE : NEON,
                                        fontFamily: 'var(--font-display)',
                                        fontSize: 13,
                                        fontWeight: 700
                                    }}>
                                        {log.hybridRiskScore ?? 0}
                                    </span>
                                </td>
                                <td style={{ color: log.honeypot ? NEON_RED : 'var(--text-muted)' }}>
                                    {log.honeypot ? '🚩 YES' : '—'}
                                </td>
                                <td>{log.attempts_per_min ?? 0}/min</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────
export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [thresholds, setThresholds] = useState({});
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);
    const MAX_ALERTS = 50;

    const fetchStats = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/stats`);
            setStats(res.data);
            setThresholds(res.data.thresholds || {});
        } catch (err) {
            console.error('Stats fetch failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Poll stats every 10s
    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, [fetchStats]);

    // Socket.io live alerts
    useEffect(() => {
        const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            console.log('[Socket.io] Connected');
        });

        socket.on('disconnect', () => setConnected(false));

        socket.on('attack_alert', (data) => {
            setAlerts(prev => [data, ...prev].slice(0, MAX_ALERTS));
            if (data.type === 'BLOCKED') {
                toast.error(`🚫 Attack Blocked: ${data.ip} (Risk: ${data.riskScore})`, { duration: 3000 });
            } else if (data.type === 'CHALLENGE') {
                toast(`⚠️ Challenge: ${data.ip} (Risk: ${data.riskScore})`, {
                    icon: '🔐',
                    style: { borderColor: 'rgba(255,140,0,0.5)' },
                    duration: 3000
                });
            }
            // Refresh stats on alert
            fetchStats();
        });

        socket.on('login_event', (data) => {
            setAlerts(prev => [data, ...prev].slice(0, MAX_ALERTS));
        });

        socket.on('thresholds_updated', (t) => {
            setThresholds(t);
            toast('⚙️ Thresholds updated by admin', { icon: '🎚️' });
        });

        return () => socket.disconnect();
    }, [fetchStats]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
                <span className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                <span style={{ color: 'var(--text-muted)', letterSpacing: 2, fontSize: 12 }}>LOADING DASHBOARD...</span>
            </div>
        );
    }

    const s = stats?.summary || {};
    const timeseries = stats?.timeseries || [];
    const recentLogs = stats?.recentLogs || [];
    const topIPs = stats?.topBlockedIPs || [];
    const countries = stats?.countryDist || [];

    return (
        <div className="dashboard-page">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <div className="dashboard-title">THREAT <span>COMMAND</span> CENTER</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, letterSpacing: 2, marginTop: 4 }}>AUTHKAVACH · REAL-TIME MONITORING</div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="live-indicator">
                        <div className={`live-dot ${connected ? '' : ''}`} style={{ background: connected ? NEON : NEON_RED }} />
                        {connected ? 'LIVE' : 'OFFLINE'}
                    </div>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }} onClick={fetchStats}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="stats-grid">
                <StatCard icon="🔍" label="Total Attempts" value={s.totalAttempts ?? 0} sub="Last 24 hours" />
                <StatCard icon="🚫" label="Blocked" value={s.blockedCount ?? 0} sub={`${s.blockRate ?? 0}% block rate`} accentColor={NEON_RED} />
                <StatCard icon="⚠️" label="Challenged" value={s.challengedCount ?? 0} sub="OTP required" accentColor={NEON_ORANGE} />
                <StatCard icon="🤖" label="ML Anomalies" value={s.anomalyCount ?? 0} sub={`Avg risk: ${s.avgRiskScore ?? 0}`} accentColor={NEON_BLUE} />
            </div>

            {/* Charts Row */}
            <div className="charts-grid">
                {/* Timeseries */}
                <div className="glass-card chart-wrapper">
                    <div className="chart-title">Login Attempts & Blocks Over Time (30-min buckets)</div>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={timeseries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.07)" />
                            <XAxis
                                dataKey="time"
                                tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                tick={{ fill: '#3a5c3a', fontSize: 10 }}
                            />
                            <YAxis tick={{ fill: '#3a5c3a', fontSize: 10 }} />
                            <Tooltip {...tooltipStyle} labelFormatter={v => new Date(v).toLocaleTimeString()} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Area dataKey="total" name="Total" stroke={NEON} fill="rgba(0,255,65,0.08)" strokeWidth={2} />
                            <Area dataKey="blocked" name="Blocked" stroke={NEON_RED} fill="rgba(255,59,59,0.08)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Alert Feed */}
                <AlertFeed alerts={alerts} />
            </div>

            {/* Bottom Row */}
            <div className="bottom-grid">
                {/* Top Blocked IPs */}
                <div className="glass-card chart-wrapper">
                    <div className="chart-title">Top Blocked IPs</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={topIPs.map(d => ({ name: d.ip, count: d.count }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.07)" />
                            <XAxis dataKey="name" tick={{ fill: '#3a5c3a', fontSize: 9 }} />
                            <YAxis tick={{ fill: '#3a5c3a', fontSize: 10 }} />
                            <Tooltip {...tooltipStyle} />
                            <Bar dataKey="count" name="Blocks" fill={NEON_RED} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Risk Score Distribution */}
                <div className="glass-card chart-wrapper">
                    <div className="chart-title">Avg Risk Score Over Time</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={timeseries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,65,0.07)" />
                            <XAxis
                                dataKey="time"
                                tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                tick={{ fill: '#3a5c3a', fontSize: 10 }}
                            />
                            <YAxis domain={[0, 100]} tick={{ fill: '#3a5c3a', fontSize: 10 }} />
                            <Tooltip {...tooltipStyle} />
                            <Line dataKey="avgRisk" name="Avg Risk" stroke={NEON_ORANGE} strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Feature Radar */}
                <FeatureRadar logs={recentLogs} />
            </div>

            {/* Recent Logs Table */}
            <div style={{ marginTop: 16 }}>
                <RecentLogsTable logs={recentLogs} />
            </div>

            {/* Threshold Sliders */}
            <div style={{ marginTop: 16 }}>
                <ThresholdPanel thresholds={thresholds} onUpdate={setThresholds} />
            </div>
        </div>
    );
}
