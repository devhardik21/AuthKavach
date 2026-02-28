const User = require('../models/User');

/**
 * Check if the current device fingerprint matches user's known devices.
 * Returns 1 (device change, anomaly) or 0 (known device)
 */
async function checkDeviceChange(username, fingerprint) {
    if (!fingerprint) return 0;
    try {
        const user = await User.findOne({ username });
        if (!user) return 0;
        if (user.deviceFingerprints.length === 0) return 0; // First login, no history
        return user.deviceFingerprints.includes(fingerprint) ? 0 : 1;
    } catch {
        return 0;
    }
}

/**
 * Register a new device fingerprint for a user (keep last 5)
 */
async function registerDevice(username, fingerprint) {
    if (!fingerprint) return;
    try {
        const user = await User.findOne({ username });
        if (!user) return;
        if (!user.deviceFingerprints.includes(fingerprint)) {
            const updated = [...user.deviceFingerprints, fingerprint].slice(-5);
            await User.updateOne({ username }, { deviceFingerprints: updated });
        }
    } catch { /* silent */ }
}

module.exports = { checkDeviceChange, registerDevice };
