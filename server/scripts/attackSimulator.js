/**
 * AuthKavach Attack Simulator
 * Fires various attack patterns to demonstrate the detection system.
 * Run: node scripts/attackSimulator.js
 */
require('dotenv').config({ path: '../.env' });
const axios = require('axios');

const BASE_URL = process.env.SIMULATOR_URL || 'http://localhost:5001';

const USERNAMES = ['admin', 'user1', 'john.doe', 'alice', 'bob', 'system', 'root', 'test'];
const PASSWORDS = ['password123', 'admin', '123456', 'letmein', 'qwerty', 'pass', 'abc123'];
const FAKE_FINGERPRINTS = ['fp_bot_001', 'fp_bot_002', 'fp_bot_003', 'fp_bot_004', 'fp_attacker_777'];
const FAKE_IPS = ['192.0.2.100', '198.51.100.50', '203.0.113.42', '45.33.32.156', '134.209.82.43'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fireRequest(options = {}) {
    const {
        username = randomItem(USERNAMES),
        password = randomItem(PASSWORDS),
        fingerprint = randomItem(FAKE_FINGERPRINTS),
        honeypot = '',
        typingSpeed = (Math.random() * 0.5 + 0.1).toFixed(2), // suspiciously fast
        label = 'attack'
    } = options;

    try {
        const res = await axios.post(`${BASE_URL}/api/auth/login`, {
            username, password, fingerprint, honeypot, typingSpeed
        }, {
            headers: {
                'X-Forwarded-For': randomItem(FAKE_IPS),
                'Content-Type': 'application/json'
            },
            validateStatus: () => true
        });

        const { action, riskScore } = res.data;
        console.log(`[${label.toUpperCase().padEnd(12)}] ${username}@${password} → Action: ${(action || res.data.error || '?').padEnd(12)} | Risk: ${riskScore ?? '?'} | Status: ${res.status}`);
        return res.data;
    } catch (err) {
        console.error(`[SIMULATOR] Request failed: ${err.message}`);
    }
}

async function runScenario(name, fn) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  SCENARIO: ${name}`);
    console.log(`${'═'.repeat(60)}`);
    await fn();
}

async function main() {
    console.log('\n🚨 AuthKavach Attack Simulator Starting...\n');
    await sleep(500);

    // ── Scenario 1: High velocity stuffing (rapid fire single IP)
    await runScenario('Credential Stuffing — Rapid Fire', async () => {
        for (let i = 0; i < 15; i++) {
            await fireRequest({ label: 'stuffing', typingSpeed: 0.05 });
            await sleep(100);
        }
    });

    await sleep(1000);

    // ── Scenario 2: Honeypot triggered (bot fills hidden field)
    await runScenario('Bot with Honeypot Triggered', async () => {
        for (let i = 0; i < 5; i++) {
            await fireRequest({ honeypot: 'I am a bot', label: 'honeypot', typingSpeed: 0.02 });
            await sleep(300);
        }
    });

    await sleep(1000);

    // ── Scenario 3: Normal human login (slow typing, consistent fingerprint)
    await runScenario('Normal Human Login (Expected: ALLOW)', async () => {
        await fireRequest({
            username: 'hs@gmail.com',
            password: '123456',
            fingerprint: 'fp_human_legit_device_abc',
            honeypot: '',
            typingSpeed: 3.8,
            label: 'normal'
        });
    });

    await sleep(1000);

    // ── Scenario 4: Distributed attack from multiple IPs
    await runScenario('Distributed Attack — Many IPs', async () => {
        const ips = ['45.33.32.10', '198.51.100.1', '203.0.113.5', '192.0.2.200', '1.2.3.4'];
        for (const ip of ips) {
            for (let j = 0; j < 3; j++) {
                await fireRequest({ label: 'distributed', typingSpeed: 0.1 });
                await sleep(150);
            }
        }
    });

    await sleep(1000);

    // ── Scenario 5: Username enumeration (many unique accounts from one IP)
    await runScenario('Username Enumeration (Unique Accounts)', async () => {
        for (let i = 0; i < 10; i++) {
            await fireRequest({
                username: `user${i}_target`,
                label: 'enumeration',
                typingSpeed: 0.08
            });
            await sleep(200);
        }
    });

    console.log('\n✅ Simulation complete. Check the admin dashboard for results.\n');
}

main().catch(console.error);
