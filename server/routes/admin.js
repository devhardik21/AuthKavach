const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { getThresholds, updateThresholds } = require('../services/riskEngine');

// ────────────────────────────────────────────
// GET /api/admin/stats — Dashboard aggregation
// ────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

        const [totalAttempts, blockedCount, challengedCount, anomalyCount, avgRisk, recentLogs, timeseriesData] = await Promise.all([
            Log.countDocuments({ timestamp: { $gte: since } }),
            Log.countDocuments({ action: 'BLOCK', timestamp: { $gte: since } }),
            Log.countDocuments({ action: 'CHALLENGE', timestamp: { $gte: since } }),
            Log.countDocuments({ mlAnomaly: true, timestamp: { $gte: since } }),
            Log.aggregate([
                { $match: { timestamp: { $gte: since } } },
                { $group: { _id: null, avg: { $avg: '$hybridRiskScore' } } }
            ]),
            // Recent 50 logs
            Log.find({}).sort({ timestamp: -1 }).limit(50).lean(),
            // Timeseries: group by 30-min buckets for last 24h
            Log.aggregate([
                { $match: { timestamp: { $gte: since } } },
                {
                    $group: {
                        _id: {
                            $toDate: {
                                $subtract: [
                                    { $toLong: '$timestamp' },
                                    { $mod: [{ $toLong: '$timestamp' }, 30 * 60 * 1000] }
                                ]
                            }
                        },
                        total: { $sum: 1 },
                        blocked: { $sum: { $cond: [{ $eq: ['$action', 'BLOCK'] }, 1, 0] } },
                        avgRisk: { $avg: '$hybridRiskScore' },
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        // Top blocked IPs
        const topBlockedIPs = await Log.aggregate([
            { $match: { action: 'BLOCK', timestamp: { $gte: since } } },
            { $group: { _id: '$ip', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Country distribution
        const countryDist = await Log.aggregate([
            { $match: { timestamp: { $gte: since } } },
            { $group: { _id: '$country', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 }
        ]);

        res.json({
            summary: {
                totalAttempts,
                blockedCount,
                challengedCount,
                anomalyCount,
                allowedCount: totalAttempts - blockedCount - challengedCount,
                avgRiskScore: Math.round((avgRisk[0]?.avg || 0) * 10) / 10,
                blockRate: totalAttempts > 0 ? Math.round((blockedCount / totalAttempts) * 100) : 0
            },
            timeseries: timeseriesData.map(d => ({
                time: d._id,
                total: d.total,
                blocked: d.blocked,
                avgRisk: Math.round(d.avgRisk * 10) / 10
            })),
            recentLogs,
            topBlockedIPs: topBlockedIPs.map(d => ({ ip: d._id, count: d.count })),
            countryDist: countryDist.map(d => ({ country: d._id || 'Unknown', count: d.count })),
            thresholds: getThresholds()
        });
    } catch (err) {
        console.error('[Admin Stats]', err.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /api/admin/logs — Recent logs with pagination
router.get('/logs', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    try {
        const [logs, total] = await Promise.all([
            Log.find({}).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
            Log.countDocuments()
        ]);
        res.json({ logs, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// POST /api/admin/thresholds — Update thresholds at runtime
router.post('/thresholds', async (req, res) => {
    try {
        const updated = updateThresholds(req.body);
        // Emit to all connected clients
        const io = req.app.get('io');
        if (io) io.emit('thresholds_updated', updated);
        res.json({ message: 'Thresholds updated', thresholds: updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update thresholds' });
    }
});

module.exports = router;
