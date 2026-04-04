/**
 * Netlify Serverless Function: /transcribe
 *
 * Tar emot base64-kodat ljud från frontend,
 * skickar till OpenAI Whisper API och returnerar svensk text.
 *
 * Miljövariabel som MÅSTE sättas i Netlify:
 *   OPENAI_API_KEY = sk-...
 *
 * Anropas via: POST /.netlify/functions/transcribe
 * Body (JSON): { audio: "<base64>", mimeType: "audio/webm" }
 */

const FormData = require('form-data');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Kontrollera API-nyckel
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY saknas i miljövariabler');
    return {
      statusCode: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'OPENAI_API_KEY är inte konfigurerat. Lägg till den i Netlify → Site configuration → Environment variables.'
      })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { audio, mimeType } = body;

    if (!audio) {
      return {
        statusCode: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Saknar audio i request body' })
      };
    }

    // Konvertera base64 → Buffer
    const buffer = Buffer.from(audio, 'base64');

    // Bestäm filändelse
    const ext = (mimeType || '').includes('mp4') ? 'mp4'
              : (mimeType || '').includes('ogg') ? 'ogg'
              : 'webm';

    // Bygg multipart/form-data för Whisper
    const form = new FormData();
    form.append('file', buffer, {
      filename: `recording.${ext}`,
      contentType: mimeType || 'audio/webm'
    });
    form.append('model', 'whisper-1');
    form.append('language', 'sv');

    // Anropa OpenAI Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      body: form
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Whisper API-fel:', data);
      return {
        statusCode: response.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data.error?.message || 'Whisper API-fel' })
      };
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: data.text || '' })
    };

  } catch (err) {
    console.error('Oväntat fel:', err);
    return {
      statusCode: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Serverfel' })
    };
  }
};
