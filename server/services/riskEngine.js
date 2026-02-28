/**
 * Hybrid Risk Engine
 * Combines rule-based scoring with ML inference to produce a final risk score and decision.
 *
 * Thresholds are stored here and can be updated via admin API at runtime.
 */

// Mutable thresholds (admin can update via /api/admin/thresholds)
let THRESHOLDS = {
    velocity_high: 5,         // attempts/min to trigger +40
    velocity_block: 10,       // hard block override
    abuse_ip: 50,             // AbuseIPDB score to trigger +30
    fail_ratio_high: 0.8,     // 80% fails to trigger +20
    unique_accounts_high: 5,  // unique accounts/IP to trigger +30
    risk_block: 70,           // risk score >= this → BLOCK
    risk_challenge: 30        // risk score >= this → CHALLENGE
};

function getThresholds() {
    return { ...THRESHOLDS };
}

function updateThresholds(updates) {
    THRESHOLDS = { ...THRESHOLDS, ...updates };
    return THRESHOLDS;
}

/**
 * Compute rule-based risk score (0–200 max theoretically)
 */
function computeRuleScore(features, abuseScore) {
    const t = THRESHOLDS;
    let score = 0;

    if (features.attempts_per_min > t.velocity_high) score += 40;
    if (abuseScore > t.abuse_ip) score += 30;
    if (features.device_change === 1) score += 30;
    if (features.fail_ratio > t.fail_ratio_high) score += 20;
    if (features.unique_accounts > t.unique_accounts_high) score += 30;
    if (features.geo_anomaly === 1) score += 20;
    if (features.honeypot === 1) score += 50;

    return score;
}

/**
 * Main risk computation
 * @param {object} features - { attempts_per_min, fail_ratio, unique_accounts, device_change, geo_anomaly, honeypot, typing_speed }
 * @param {number} abuseScore - from AbuseIPDB (0-100)
 * @param {object} mlResult   - { risk_score, action, is_anomaly }
 * @returns {{ ruleScore, hybridScore, action }}
 */
function computeHybridRisk(features, abuseScore, mlResult) {
    const t = THRESHOLDS;
    let ruleScore = computeRuleScore(features, abuseScore);

    // Apply ML boost: ML risk_score scaled to 0-100
    const mlBoost = Math.round(mlResult.risk_score * 100);
    if (mlResult.is_anomaly) {
        ruleScore += mlBoost;
    }

    // Hard overrides
    if (features.honeypot === 1 || features.attempts_per_min > t.velocity_block) {
        ruleScore = Math.max(ruleScore, 95);
    }

    const hybridScore = Math.min(ruleScore, 100);

    let action;
    if (hybridScore >= t.risk_block || mlResult.action === 'BLOCK') {
        action = 'BLOCK';
    } else if (hybridScore >= t.risk_challenge || mlResult.action === 'CHALLENGE') {
        action = 'CHALLENGE';
    } else {
        action = 'ALLOW';
    }

    return { ruleScore, hybridScore, action };
}

module.exports = { computeHybridRisk, getThresholds, updateThresholds };
