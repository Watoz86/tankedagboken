exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'OPENAI_API_KEY not set' }) };
    }

    const { audio, mimeType } = JSON.parse(event.body);
    const buffer = Buffer.from(audio, 'base64');
    const ext = mimeType?.includes('ogg') ? 'ogg' : 'webm';

    // Use native Web API FormData + Blob (Node 18)
    const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
    const form = new FormData();
    form.append('file', blob, `recording.${ext}`);
    form.append('model', 'whisper-1');
    form.append('language', 'sv');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form
    });

    const data = await response.json();
    if (!response.ok) {
      return { statusCode: response.status, headers: cors, body: JSON.stringify({ error: data.error?.message || 'OpenAI error' }) };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ text: data.text }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
