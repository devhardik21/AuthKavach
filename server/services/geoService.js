const axios = require('axios');
const User = require('../models/User');

/**
 * Fetch geolocation for an IP using ipapi.co
 * Returns { country, city, lat, lon }
 */
async function getGeoInfo(ip) {
    // Skip for localhost / private IPs
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
        return { country: 'LOCAL', city: 'localhost', lat: 0, lon: 0 };
    }
    try {
        const res = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 3000 });
        const { country_name, city, latitude, longitude } = res.data;
        return {
            country: country_name || 'Unknown',
            city: city || 'Unknown',
            lat: latitude || 0,
            lon: longitude || 0
        };
    } catch {
        return { country: 'Unknown', city: 'Unknown', lat: 0, lon: 0 };
    }
}

/**
 * Check whether the current geo differs from user's history
 * Returns 1 if anomaly, 0 if normal
 */
async function checkGeoAnomaly(username, currentGeo) {
    try {
        const user = await User.findOne({ username });
        if (!user || user.geoHistory.length === 0) return 0;

        // Get the last known country
        const lastGeo = user.geoHistory[user.geoHistory.length - 1];
        if (lastGeo.country === 'LOCAL' || currentGeo.country === 'LOCAL') return 0;
        if (lastGeo.country !== currentGeo.country) return 1;
        return 0;
    } catch {
        return 0;
    }
}

/**
 * Update user's geo history (keep last 10)
 */
async function updateGeoHistory(username, geoInfo) {
    try {
        await User.findOneAndUpdate(
            { username },
            {
                $push: {
                    geoHistory: {
                        $each: [{ ...geoInfo, timestamp: new Date() }],
                        $slice: -10
                    }
                }
            }
        );
    } catch { /* silent */ }
}

module.exports = { getGeoInfo, checkGeoAnomaly, updateGeoHistory };
