const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

const SHARED_SECRET = 'tajne-heslo-kuryra-123';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWebhook(callbackUrl, orderId, status, eventId) {
    try {
        const payload = { id: orderId, status: status, event_id: eventId };
        const body = JSON.stringify(payload);

        const signature = crypto.createHmac('sha256', SHARED_SECRET)
                                  .update(body, 'utf8')
                                  .digest('hex');

        console.log(`Odesílám webhook (event: ${eventId}) pro ${orderId} se stavem: ${status}`);
        const response = await fetch(callbackUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Signature': signature 
            },
            body: body
        });
        console.log(`Webhook (${eventId}) dorazil s kódem:`, response.status);
    } catch (error) {
        console.error(`Chyba při odesílání webhooku:`, error);
    }
}

app.post('/order', async (req, res) => {
    const order = req.body;
    console.log(`Přijata objednávka ${order.id}`);

    res.sendStatus(202);

    const event1 = crypto.randomUUID();
    const event2 = crypto.randomUUID();
    const event3 = crypto.randomUUID();

    await sleep(5000);
    await sendWebhook(order.callbackUrl, order.id, 'Restaurace připravuje', event1);

    await sleep(5000);
    await sendWebhook(order.callbackUrl, order.id, 'Rozváží se', event2);

    await sleep(1000);
    console.log('--- SIMULACE DUPLIKACE ---');
    await sendWebhook(order.callbackUrl, order.id, 'Rozváží se', event2);

    await sleep(4000);
    await sendWebhook(order.callbackUrl, order.id, 'Doručeno', event3);
});

app.listen(3000, () => {
    console.log('Courier runs on http://localhost:3000');
});