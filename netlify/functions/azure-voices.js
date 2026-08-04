const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=21600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Ocp-Apim-Subscription-Key',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function normalizeVoice(item = {}) {
  const locale = String(item.Locale || item.locale || '').trim();
  const localeName = String(item.LocaleName || item.localeName || locale || 'English').trim();
  const displayName = String(item.DisplayName || item.displayName || item.ShortName || item.shortName || '').trim();
  const localName = String(item.LocalName || item.localName || displayName || item.ShortName || item.shortName || '').trim();
  const shortName = String(item.ShortName || item.shortName || '').trim();
  const gender = String(item.Gender || item.gender || 'Unknown').trim();
  const voiceType = String(item.VoiceType || item.voiceType || 'Unknown').trim();
  const styleList = Array.isArray(item.StyleList)
    ? item.StyleList.map((style) => String(style).trim()).filter(Boolean)
    : typeof item.styleList === 'string'
      ? item.styleList.split(',').map((style) => style.trim()).filter(Boolean)
      : [];

  return {
    shortName,
    displayName,
    localName,
    locale,
    localeName,
    gender,
    voiceType,
    styleList,
  };
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
    const text = await response.text().catch(() => '');
    const sanitizedText = text ? text.slice(0, 160) : '';
    throw new Error(`Azure voice catalog request failed (${response.status}). ${sanitizedText}`.trim());
  }

  const data = await response.json().catch(() => []);
  const englishNeural = (Array.isArray(data) ? data : [])
    .filter((entry) => {
      const locale = String(entry.Locale || entry.locale || '').trim();
      const voiceType = String(entry.VoiceType || entry.voiceType || '').trim();
      return locale.toLowerCase().startsWith('en-') && voiceType.toLowerCase() === 'neural';
    })
    .map(normalizeVoice)
    .filter((voice) => voice.shortName && voice.locale)
    .sort((a, b) => {
      const localeCompare = (a.locale || '').localeCompare(b.locale || '');
      if (localeCompare !== 0) return localeCompare;
      const genderCompare = (a.gender || '').localeCompare(b.gender || '');
      if (genderCompare !== 0) return genderCompare;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

  return englishNeural;
}

exports.handler = async function (event) {
  if (event && event.httpMethod === 'OPTIONS') {
    return jsonResponse({ ok: true }, 200);
  }

  if (!event || !event.httpMethod) {
    return jsonResponse({ error: 'This endpoint accepts GET requests only.' }, 405);
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse({ error: 'This endpoint accepts GET requests only.' }, 405);
  }

  const region = (process.env.AZURE_SPEECH_REGION || 'eastus').trim() || 'eastus';
  const cacheKey = `azure-voices:${region}`;
  const currentCache = globalThis.__bmcVoiceCache || {};

  if (currentCache[cacheKey] && currentCache[cacheKey].expiresAt > Date.now()) {
    return jsonResponse(currentCache[cacheKey].data, 200, {
      'Cache-Control': 'public, max-age=21600',
    });
  }

  try {
    const voices = await getVoiceCatalog(region);
    globalThis.__bmcVoiceCache = globalThis.__bmcVoiceCache || {};
    globalThis.__bmcVoiceCache[cacheKey] = {
      data: voices,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return jsonResponse(voices, 200, {
      'Cache-Control': 'public, max-age=21600',
    });
  } catch (error) {
    const message = error && error.message ? error.message : 'Azure voice catalog is temporarily unavailable.';
    const safeMessage = message.includes('AZURE_SPEECH_KEY')
      ? 'Voice service credentials are not configured on Netlify.'
      : 'The Azure English voice catalog could not be loaded right now.';

    return jsonResponse({
      error: safeMessage,
      message: safeMessage,
    }, 502);
  }
};
