import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Ruta para verificación de webhook (Meta)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Ruta para recibir mensajes entrantes de WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    const phoneNumber = message?.from;
    const text = message?.text?.body;

    if (text && phoneNumber) {
      console.log('Mensaje recibido:', text);

      const aiReply = await getGeminiReply(text);
      await sendMessage(phoneNumber, aiReply);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.sendStatus(500);
  }
});

// Función para enviar mensaje por WhatsApp
async function sendMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// Función para obtener respuesta desde Gemini
async function getGeminiReply(userInput) {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: userInput }] }],
    }
  );

  const text =
    response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
    'No tengo una respuesta en este momento.';
  return text;
}

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor corriendo en puerto', PORT));
