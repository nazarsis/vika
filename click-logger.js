const http = require('http');
const https = require('https');
const url = require('url');

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
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const now = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });

                let emoji = '🔗';
                if (data.link?.includes('youtube')) emoji = '🎬';
                if (data.link?.includes('tiktok')) emoji = '🎵';
                if (data.link?.includes('buymeacoffee')) emoji = '☕';

                const message = `${emoji} <b>Клік на v.sloboda.fun</b>\n\n` +
                    `📍 <b>Посилання:</b> ${data.linkName || data.link}\n` +
                    `🕐 <b>Час:</b> ${now}\n` +
                    `📱 <b>Пристрій:</b> ${data.device || 'Невідомо'}`;

                sendTelegram(message);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
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
