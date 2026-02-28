const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User');

function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

async function sendOTPEmail(email, otp) {
    const user = process.env.NODEMAILER_USER;
    const pass = process.env.NODEMAILER_PASS;

    if (!user || user === 'your_email@gmail.com') {
        console.log(`[OTP] Dev mode - OTP for ${email}: ${otp}`);
        return true;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    await transporter.sendMail({
        from: `"AuthKavach Security" <${user}>`,
        to: email,
        subject: '🔐 AuthKavach - Login Verification Code',
        html: `
      <div style="font-family:monospace;background:#0a0f0a;color:#00ff41;padding:30px;border-radius:8px;">
        <h2 style="color:#39ff14;">AuthKavach Security Alert</h2>
        <p>A suspicious login attempt was detected for your account.</p>
        <p>Your one-time verification code is:</p>
        <h1 style="color:#fff;letter-spacing:8px;font-size:42px;">${otp}</h1>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#888;font-size:12px;">If you did not initiate this login, ignore this email and consider changing your password.</p>
      </div>
    `
    });
    return true;
}

async function createAndSendOTP(username) {
    const user = await User.findOne({ username });
    if (!user) return null;

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await User.updateOne({ username }, { otpCode: otp, otpExpiry: expiry });
    await sendOTPEmail(user.email, otp);
    return otp;
}

async function verifyOTP(username, code) {
    const user = await User.findOne({ username });
    if (!user) return false;
    if (!user.otpCode || user.otpExpiry < new Date()) return false;
    if (user.otpCode !== code) return false;

    await User.updateOne({ username }, { otpCode: null, otpExpiry: null });
    return true;
}

module.exports = { createAndSendOTP, verifyOTP };
