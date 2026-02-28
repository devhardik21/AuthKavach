const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  deviceFingerprints: [{ type: String }],
  geoHistory: [
    {
      country: String,
      city: String,
      lat: Number,
      lon: Number,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  otpCode: { type: String },
  otpExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
