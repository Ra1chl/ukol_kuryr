const express = require('express');
const crypto = require('crypto');
const app = express();

const SHARED_SECRET = 'tajne-heslo-kuryra-123';

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use(express.static('public'));

const orders = {};
const processedEvents = new Set(); 

app.post('/update', (req, res) => {
    const sigHeader = (req.get('X-Signature') || '').trim();

    if (!sigHeader) {
        console.log('[BEZPEČNOST] Chybí hlavička X-Signature!');
        return res.status(401).json({ error: 'Missing signature' });
    }

    try {
        const expected = crypto.createHmac('sha256', SHARED_SECRET)
                               .update(req.rawBody)
                               .digest('hex');

        const sigBuffer = Buffer.from(sigHeader, 'hex');
        const expectedBuffer = Buffer.from(expected, 'hex');

        if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
            console.log('[BEZPEČNOST] Neplatný podpis!');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const { id, status, event_id } = req.body;

        if (processedEvents.has(event_id)) {
            console.log(`[DUPLICITA IGNOROVÁNA] Událost ${event_id} již byla zpracována.`);
            return res.sendStatus(200);
        }

        processedEvents.add(event_id);

        orders[id] = status;
        console.log(`[WEBHOOK OK] Přijat stav pro objednávku ${id}: "${status}" (event: ${event_id})`);
        
        res.sendStatus(200);

    } catch (error) {
        console.error('Chyba při zpracování webhooku:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/orders', (req, res) => {
    res.json(orders);
});

async function sendOrder(orderId) {
    try {
        console.log(`Odesílám objednávku ${orderId} kurýrovi...`);
        const response = await fetch('http://localhost:3000/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: orderId,
                callbackUrl: 'http://localhost:3001/update'
            })
        });
        console.log(`Kurýr potvrdil převzetí (${orderId}):`, response.status);
    } catch (error) {
        console.error('Chyba při odesílání objednávky:', error);
    }
}

app.post('/create-order', (req, res) => {
    const orderId = 'obj_' + Math.floor(1000 + Math.random() * 9000);
    orders[orderId] = 'Žádost o objednávku';
    sendOrder(orderId);
    res.json({ success: true, id: orderId });
});

app.listen(3001, () => {
    console.log('Restaurant runs on http://localhost:3001');
});