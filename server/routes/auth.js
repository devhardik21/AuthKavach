const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const User = require('../models/User');
const Log = require('../models/Log');
const { getVelocity, getUniqueAccounts, trackFailedAttempt } = require('../services/redisService');
const { getGeoInfo, checkGeoAnomaly, updateGeoHistory } = require('../services/geoService');
const { checkAbuseIPDB } = require('../services/abuseIPService');
const { callMLAPI } = require('../services/mlService');
const { computeHybridRisk } = require('../services/riskEngine');
const { checkDeviceChange, registerDevice } = require('../services/deviceService');
const { createAndSendOTP } = require('../services/otpService');

const JWT_SECRET = process.env.JWT_SECRET || 'authkavach_dev_secret';

// ────────────────────────────────────────────
// POST /api/auth/register
// ────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'username, password, and email are required' });
    }

    try {
        const exists = await User.findOne({ $or: [{ username }, { email }] });
        if (exists) return res.status(409).json({ error: 'Username or email already taken' });

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({ username: username.toLowerCase(), passwordHash, email });

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ message: 'User registered successfully', token });
    } catch (err) {
        console.error('[Register]', err.message);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// ────────────────────────────────────────────
// POST /api/auth/login — Full detection pipeline
// ────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const io = req.app.get('io');

    // 1. Extract request metadata
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    const ip = rawIp.replace('::ffff:', ''); // normalize IPv4-mapped IPv6
    const { username, password, fingerprint, honeypot, typingSpeed } = req.body;

    // 2. Honeypot check (trap field filled by bots)
    const honeypotTriggered = honeypot && honeypot.length > 0 ? 1 : 0;

    const logData = {
        ip,
        username: username || 'unknown',
        honeypot: honeypotTriggered,
        typing_speed: parseFloat(typingSpeed) || 3.5,
    };

    try {
        // 3. Gather features in parallel (non-blocking where possible)
        const [velocity, uniqueAccounts, geoInfo, abuseScore] = await Promise.all([
            getVelocity(ip),
            getUniqueAccounts(ip, username || 'unknown'),
            getGeoInfo(ip),
            checkAbuseIPDB(ip)
        ]);

        // 4. Device fingerprint check
        const deviceChange = await checkDeviceChange(username, fingerprint);

        // 5. Geo anomaly check (needs username)
        const geoAnomaly = username ? await checkGeoAnomaly(username, geoInfo) : 0;

        // 6. Fail ratio (pre-auth — we don't know if this will fail yet)
        let failRatio = 0;
        try {
            const Log = require('../models/Log');
            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
            const [fails, total] = await Promise.all([
                Log.countDocuments({ ip, success: false, timestamp: { $gte: fiveMinsAgo } }),
                Log.countDocuments({ ip, timestamp: { $gte: fiveMinsAgo } }),
            ]);
            failRatio = total > 0 ? fails / total : 0;
        } catch { /* use 0 */ }

        // 7. Build features object
        const features = {
            attempts_per_min: velocity,
            fail_ratio: Math.round(failRatio * 100) / 100,
            unique_accounts: uniqueAccounts,
            device_change: deviceChange,
            geo_anomaly: geoAnomaly,
            honeypot: honeypotTriggered,
            typing_speed: parseFloat(typingSpeed) || 3.5
        };

        // 8. ML inference
        const mlResult = await callMLAPI(features);

        // 9. Hybrid risk computation
        const { ruleScore, hybridScore, action } = computeHybridRisk(features, abuseScore, mlResult);

        // 10. Update log data
        Object.assign(logData, {
            ...features,
            abuseScore,
            ruleScore,
            mlRiskScore: mlResult.risk_score,
            mlAnomaly: mlResult.is_anomaly,
            hybridRiskScore: hybridScore,
            action,
            country: geoInfo.country,
            city: geoInfo.city,
        });

        // 11. BLOCK decision
        if (action === 'BLOCK') {
            logData.success = false;
            await Log.create(logData);

            // Emit socket event
            if (io) io.emit('attack_alert', {
                type: 'BLOCKED',
                ip,
                username: username || 'unknown',
                riskScore: hybridScore,
                features,
                timestamp: new Date()
            });

            return res.status(403).json({
                error: 'Access denied. Suspicious activity detected.',
                action: 'BLOCK',
                riskScore: hybridScore
            });
        }

        // 12. CHALLENGE decision
        if (action === 'CHALLENGE') {
            // Send OTP (dev mode just logs to console)
            if (username) await createAndSendOTP(username);

            logData.success = false;
            await Log.create(logData);

            if (io) io.emit('attack_alert', {
                type: 'CHALLENGE',
                ip,
                username: username || 'unknown',
                riskScore: hybridScore,
                features,
                timestamp: new Date()
            });

            return res.status(200).json({
                action: 'CHALLENGE',
                message: 'Additional verification required. Check your email for OTP.',
                riskScore: hybridScore
            });
        }

        // 13. ALLOW — validate credentials
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            logData.success = false;
            await Log.create(logData);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            logData.success = false;
            await Log.create(logData);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Valid login — register device & update geo
        await Promise.all([
            registerDevice(username, fingerprint),
            updateGeoHistory(username, geoInfo)
        ]);

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        logData.success = true;
        await Log.create(logData);

        if (io) io.emit('login_event', {
            type: 'SUCCESS',
            ip,
            username: username || 'unknown',
            riskScore: hybridScore,
            timestamp: new Date()
        });

        return res.json({ action: 'ALLOW', token, username: user.username, riskScore: hybridScore });

    } catch (err) {
        console.error('[Login]', err.message);
        // Still log even on error
        try { await Log.create({ ...logData, action: 'ALLOW', success: false }); } catch { }
        return res.status(500).json({ error: 'Login processing failed' });
    }
});

// ────────────────────────────────────────────
// POST /api/auth/verify-otp
// ────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
    const { username, otp, password } = req.body;
    const { verifyOTP } = require('../services/otpService');

    try {
        const valid = await verifyOTP(username, otp);
        if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP' });

        // If OTP valid, verify password and issue token
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ action: 'ALLOW', token, username: user.username });
    } catch (err) {
        console.error('[OTP Verify]', err.message);
        res.status(500).json({ error: 'OTP verification failed' });
    }
});

module.exports = router;
