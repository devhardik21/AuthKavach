const axios = require('axios');

const ML_API_URL = process.env.ML_API_URL || 'https://ml-api.example.com/predict';

// ──────────────────────────────────────────
// ML Input / Output structured logger
// ──────────────────────────────────────────
function logMLCall({ source, input, output }) {
    const ts = new Date().toISOString();
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  [ML] ${source.padEnd(39)}║`);
    console.log(`║  Time: ${ts.padEnd(37)}║`);
    console.log(`╠══════════════════════════════════════════════╣`);
    console.log(`║  INPUT FEATURES:`);
    console.log(`║    attempts_per_min : ${String(input.attempts_per_min).padEnd(23)}║`);
    console.log(`║    fail_ratio       : ${String(input.fail_ratio).padEnd(23)}║`);
    console.log(`║    unique_accounts  : ${String(input.unique_accounts).padEnd(23)}║`);
    console.log(`║    device_change    : ${String(input.device_change).padEnd(23)}║`);
    console.log(`║    geo_anomaly      : ${String(input.geo_anomaly).padEnd(23)}║`);
    console.log(`║    honeypot         : ${String(input.honeypot).padEnd(23)}║`);
    console.log(`║    typing_speed     : ${String(input.typing_speed).padEnd(23)}║`);
    console.log(`╠══════════════════════════════════════════════╣`);
    console.log(`║  ML RESPONSE:`);
    console.log(`║    risk_score       : ${String(output.risk_score).padEnd(23)}║`);
    console.log(`║    action           : ${String(output.action).padEnd(23)}║`);
    console.log(`║    is_anomaly       : ${String(output.is_anomaly).padEnd(23)}║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);
}

/**
 * Dummy ML response for testing (matches real API schema)
 *
 * Expected input:
 * {
 *   "attempts_per_min": 3,
 *   "fail_ratio": 0.4,
 *   "unique_accounts": 1,
 *   "device_change": 1,
 *   "geo_anomaly": 1,
 *   "honeypot": 0,
 *   "typing_speed": 2.1
 * }
 *
 * Expected output:
 * {
 *   "risk_score": 0.636,
 *   "action": "MFA",
 *   "is_anomaly": true
 * }
 */
function dummyMLResponse(features) {
    const { attempts_per_min, fail_ratio, unique_accounts, device_change, geo_anomaly, honeypot } = features;

    // High-confidence bot indicators
    if (honeypot === 1 || attempts_per_min > 10) {
        return { risk_score: 0.92, action: 'BLOCK', is_anomaly: true };
    }
    // High suspicion — device/geo anomaly combined WITH suspicious behaviour (fail ratio)
    if ((device_change === 1 || geo_anomaly === 1) && fail_ratio > 0.3) {
        return { risk_score: 0.636, action: 'CHALLENGE', is_anomaly: true };
    }
    // Higher suspicion — pure velocity / credential stuffing signs
    if (attempts_per_min > 5 || fail_ratio > 0.8 || unique_accounts > 5) {
        return { risk_score: 0.55, action: 'CHALLENGE', is_anomaly: true };
    }
    // New device + new geo — totally normal for a real user on a different network.
    // Trigger CHALLENGE (OTP) but do NOT mark as anomaly (no ML boost).
    if (device_change === 1 && geo_anomaly === 1) {
        return { risk_score: 0.35, action: 'CHALLENGE', is_anomaly: false };
    }
    // Device or geo anomaly alone — low-risk, just note it
    if (device_change === 1 || geo_anomaly === 1) {
        return { risk_score: 0.20, action: 'ALLOW', is_anomaly: false };
    }
    // Normal
    return { risk_score: 0.107, action: 'ALLOW', is_anomaly: false };
}

/**
 * Call ML API for anomaly detection.
 * Sends features directly (flat object — matches API schema).
 * Falls back to dummy response if API unavailable.
 */
async function callMLAPI(features) {
    try {
        // Send features as a flat object directly — matches real ML API schema
        const res = await axios.post(ML_API_URL, features, { timeout: 3000 });
        const data = res.data;

        const result = {
            risk_score: data.risk_score ?? 0.1,
            action: data.action ?? 'ALLOW',
            is_anomaly: data.is_anomaly ?? false
        };

        logMLCall({ source: 'Real ML API', input: features, output: result });
        return result;
    } catch (err) {
        console.warn('[ML] API unavailable, using dummy response:', err.message);
        const result = dummyMLResponse(features);
        logMLCall({ source: 'Dummy Fallback (API offline)', input: features, output: result });
        return result;
    }
}

module.exports = { callMLAPI, dummyMLResponse };
