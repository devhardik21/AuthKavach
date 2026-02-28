const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now, index: true },
    ip: { type: String, required: true, index: true },
    username: { type: String, default: 'unknown' },
    // Features
    attempts_per_min: { type: Number, default: 0 },
    fail_ratio: { type: Number, default: 0 },
    unique_accounts: { type: Number, default: 0 },
    device_change: { type: Number, default: 0 }, // 0 or 1
    geo_anomaly: { type: Number, default: 0 },   // 0 or 1
    honeypot: { type: Number, default: 0 },       // 0 or 1
    typing_speed: { type: Number, default: 3.5 },
    // Scoring
    abuseScore: { type: Number, default: 0 },
    ruleScore: { type: Number, default: 0 },
    mlRiskScore: { type: Number, default: 0 },
    mlAnomaly: { type: Boolean, default: false },
    hybridRiskScore: { type: Number, default: 0 },
    // Decision
    action: { type: String, enum: ['ALLOW', 'CHALLENGE', 'BLOCK'], default: 'ALLOW' },
    success: { type: Boolean, default: false },
    // Geo info
    country: { type: String, default: '' },
    city: { type: String, default: '' },
});

// TTL index - keep logs for 30 days
LogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Log', LogSchema);
