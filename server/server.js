require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// ────────────────────────────────────────────
// Socket.io Setup
// ────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
});

// ────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────
app.set('trust proxy', 1); // Trust first proxy (for correct IP behind load balancers)

app.use(cors());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter (lenient — per-IP detailed rate limiting is in auth.js)
const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, slow down.' }
});

const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20, // 20 login attempts/min per IP
    skipSuccessfulRequests: false,
    message: { error: 'Too many login attempts. Please wait.' }
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login', loginLimiter);

// ────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.get('/', (req, res) => res.json({ status: 'ok', time: new Date() }));
// ────────────────────────────────────────────
// MongoDB Connection
// ────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/authkavach';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('[MongoDB] Connected:', MONGODB_URI))
    .catch(err => console.error('[MongoDB] Connection failed:', err.message));

// ────────────────────────────────────────────
// Start Server
// ────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════╗
  ║   AuthKavach Server Running          ║
  ║   Port: ${PORT}                          ║
  ║   Mode: ${process.env.NODE_ENV || 'development'}               ║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
