function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Ocp-Apim-Subscription-Key',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeRate(value) {
  const numeric = Number(value ?? 1);
  if (!Number.isFinite(numeric)) return '0%';
  const percent = Math.max(-80, Math.min(80, Math.round((numeric - 1) * 100)));
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

function normalizePitch(value) {
  const numeric = Number(value ?? 1);
  if (!Number.isFinite(numeric)) return '0%';
  const percent = Math.max(-50, Math.min(50, Math.round((numeric - 1) * 100)));
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

async function getVoiceCatalog(region) {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  if (!apiKey) {
    throw new Error('AZURE_SPEECH_KEY is not configured.');
  }

  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Accept': 'application/json',
      'User-Agent': 'BMC/2.1.1',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Azure voice catalog could not be loaded (${response.status}). ${errorText ? errorText.slice(0, 160) : ''}`.trim());
  }

  const data = await response.json().catch(() => []);
  return (Array.isArray(data) ? data : [])
    .filter((entry) => {
      const locale = String(entry.Locale || entry.locale || '').trim();
      const voiceType = String(entry.VoiceType || entry.voiceType || '').trim();
      return locale.toLowerCase().startsWith('en-') && voiceType.toLowerCase() === 'neural';
    })
    .map((entry) => String(entry.ShortName || entry.shortName || '').trim())
    .filter(Boolean);
}

export async function handler(event) {
  if (event.httpMethod && event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'This endpoint accepts POST requests only.' }, 405);
  }

  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse({ ok: true }, 200);
  }

  const region = (process.env.AZURE_SPEECH_REGION || 'eastus').trim() || 'eastus';

  try {
    const rawBody = event.body ? JSON.parse(event.body) : {};
    const text = String(rawBody.text ?? '').trim();
    const voice = String(rawBody.voice ?? '').trim();
    const rate = Number(rawBody.rate ?? 1);
    const pitch = Number(rawBody.pitch ?? 1);

    if (!text) {
      return jsonResponse({ error: 'Text is required for Azure TTS synthesis.' }, 400);
    }

    if (text.length > 1200) {
      return jsonResponse({ error: 'Text length must be 1,200 characters or fewer.' }, 400);
    }

    if (!voice) {
      return jsonResponse({ error: 'A valid Azure voice name is required.' }, 400);
    }

    const allowedVoices = new Set(await getVoiceCatalog(region));
    if (!allowedVoices.has(voice)) {
      return jsonResponse({ error: 'The selected Azure voice is not available in the English catalog.' }, 400);
    }

    const lang = voice.includes('-') ? voice.split('-').slice(0, 2).join('-') : 'en-US';
    const ssml = [
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"',
      'xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="' + escapeXml(lang) + '">',
      '<voice name="' + escapeXml(voice) + '">',
      '<prosody rate="' + normalizeRate(rate) + '" pitch="' + normalizePitch(pitch) + '">',
      escapeXml(text),
      '</prosody>',
      '</voice>',
      '</speak>',
    ].join('');

    const apiKey = process.env.AZURE_SPEECH_KEY;
    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'BMC/2.1.1',
        'Accept': 'audio/mpeg',
      },
      body: ssml,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Azure TTS synthesis failed (${response.status}). ${errorText ? errorText.slice(0, 160) : ''}`.trim());
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Ocp-Apim-Subscription-Key',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const message = error?.message || 'Azure speech synthesis is temporarily unavailable.';
    return jsonResponse({
      error: 'Azure speech synthesis failed. Please try again or use the browser voice fallback.',
      message: message.includes('AZURE_SPEECH_KEY') ? 'The Azure Speech key is not configured on Netlify.' : message,
    }, 502);
  }
}
