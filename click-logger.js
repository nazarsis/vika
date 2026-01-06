const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const https = require('https');

// Read from environment variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PORT = process.env.PORT || 3080;

// Security: Max body size (10KB)
const MAX_BODY_SIZE = 10 * 1024;

// Security: Escape HTML to prevent XSS
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Validate input data
function validateLogData(data) {
    if (typeof data !== 'object' || data === null) return false;
    if (data.linkName && typeof data.linkName !== 'string') return false;
    if (data.link && typeof data.link !== 'string') return false;
    if (data.device && typeof data.device !== 'string') return false;
    return true;
}

function sendTelegram(message) {
    if (!TELEGRAM_TOKEN || !CHAT_ID) {
        console.error('Missing TELEGRAM_TOKEN or CHAT_ID');
        return;
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const postData = JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML'
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(telegramUrl, options, (res) => {
        console.log(`Telegram response: ${res.statusCode}`);
    });

    req.on('error', (e) => {
        console.error(`Telegram error: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/log') {
        // Get IP from headers (Nginx X-Real-IP)
        const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';

        let body = '';
        let bodySize = 0;

        req.on('data', chunk => {
            bodySize += chunk.length;
            // DoS protection: reject if body too large
            if (bodySize > MAX_BODY_SIZE) {
                res.writeHead(413, { 'Content-Type': 'text/plain' });
                res.end('Request too large');
                req.destroy();
                return;
            }
            body += chunk;
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);

                // Validate input
                if (!validateLogData(data)) {
                    res.writeHead(400);
                    res.end('Invalid data');
                    return;
                }

                const now = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });

                // Determine event type
                let emoji = '🔗';
                let eventType = 'Клік';

                if (data.type === 'pageview') {
                    emoji = '👁';
                    eventType = 'Перегляд сайту';
                } else {
                    if (data.link?.includes('youtube')) emoji = '🎬';
                    else if (data.link?.includes('tiktok')) emoji = '🎵';
                    else if (data.link?.includes('buymeacoffee')) emoji = '☕';
                }

                // Escape all user-provided data
                let message = `${emoji} <b>${eventType}</b>\n\n`;
                message += `🕐 <b>Час:</b> ${now}\n`;
                message += `🌐 <b>IP:</b> ${escapeHtml(ip)}\n`;
                message += `📱 <b>Пристрій:</b> ${escapeHtml(data.device || 'Невідомо')}\n`;

                if (data.linkName && data.type !== 'pageview') {
                    message += `📍 <b>Кнопка:</b> ${escapeHtml(data.linkName)}\n`;
                }

                if (data.screenSize) {
                    message += `📐 <b>Екран:</b> ${escapeHtml(data.screenSize)}\n`;
                }

                if (data.referrer) {
                    message += `🔙 <b>Звідки:</b> ${escapeHtml(data.referrer)}\n`;
                }

                if (data.language) {
                    message += `🗣 <b>Мова:</b> ${escapeHtml(data.language)}\n`;
                }

                sendTelegram(message);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error('Parse error:', e);
                res.writeHead(400);
                res.end('Bad request');
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

server.listen(PORT, () => {
    console.log(`Click logger running on port ${PORT}`);
});
