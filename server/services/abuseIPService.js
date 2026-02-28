const axios = require('axios');

/**
 * Check IP reputation from AbuseIPDB
 * Returns abuseScore (0-100); higher = more abusive
 */
async function checkAbuseIPDB(ip) {
    const apiKey = process.env.ABUSEIPDB_API_KEY;
    if (!apiKey || apiKey === 'your_abuseipdb_api_key') {
        return 0; // Skip if no key configured
    }

    // Skip private IPs
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
        return 0;
    }

    try {
        const res = await axios.get('https://api.abuseipdb.com/api/v2/check', {
            headers: { Key: apiKey, Accept: 'application/json' },
            params: { ipAddress: ip, maxAgeInDays: 90 },
            timeout: 3000
        });
        return res.data?.data?.abuseConfidenceScore || 0;
    } catch {
        return 0;
    }
}

module.exports = { checkAbuseIPDB };
