// server.js
// Backend proxy for Gemini. Do not put your API key in frontend code.
// Add GEMINI_API_KEY as an environment variable on Render/Vercel.

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'heures-gemini-proxy' });
});

app.post('/api/assistant', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Missing GEMINI_API_KEY environment variable.'
      });
    }

    const { question, context } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Missing question.' });
    }

    const systemPrompt = `Tu es l'assistant intégré d'une application de suivi d'heures et de paie.
Réponds en français québécois, de façon claire et concise.
Tu peux expliquer les données, mais tu ne dois pas inventer de chiffres.
Si une question demande un calcul précis et que le contexte ne contient pas l'information, demande la donnée manquante.
Règles de l'app:
- Base régulière: 37,5 h par semaine.
- Overtime temps simple: de 37,5 h à 40 h.
- Overtime taux 1.5: au-dessus de 40 h.
- Les calculs critiques locaux de l'app sont prioritaires sur tes estimations.`;

    const userPrompt = `Question de l'utilisateur:\n${question}\n\nContexte local fourni par l'app:\n${JSON.stringify(context || {}, null, 2)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.25,
          topP: 0.9,
          maxOutputTokens: 700
        }
      })
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return res.status(geminiResponse.status).json({
        error: data?.error?.message || 'Gemini API error.'
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();

    res.json({
      answer: text || 'Je n’ai pas réussi à générer une réponse.',
      provider: 'gemini',
      model: GEMINI_MODEL
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Assistant backend error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Gemini assistant proxy running on port ${PORT}`);
});
