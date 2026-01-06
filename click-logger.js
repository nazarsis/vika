const http = require('http');
const https = require('https');

const TELEGRAM_TOKEN = '900714287:AAH2od9MRwPRwvVLe36Q3dhRMk9MIWtscQk';
const CHAT_ID = '25861608';
const PORT = 3080;

function sendTelegram(message) {
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
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
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

                let message = `${emoji} <b>${eventType}</b>\n\n`;
                message += `🕐 <b>Час:</b> ${now}\n`;
                message += `🌐 <b>IP:</b> ${ip}\n`;
                message += `📱 <b>Пристрій:</b> ${data.device || 'Невідомо'}\n`;

                if (data.linkName && data.type !== 'pageview') {
                    message += `📍 <b>Кнопка:</b> ${data.linkName}\n`;
                }

                if (data.screenSize) {
                    message += `📐 <b>Екран:</b> ${data.screenSize}\n`;
                }

                if (data.referrer) {
                    message += `🔙 <b>Звідки:</b> ${data.referrer}\n`;
                }

                if (data.language) {
                    message += `🗣 <b>Мова:</b> ${data.language}\n`;
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

server.listen(PORT, () => {
    console.log(`Click logger running on port ${PORT}`);
});
