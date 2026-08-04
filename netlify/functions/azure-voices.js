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

async function getVoiceCatalog(region, key) {
  if (!key) {
    throw new Error('AZURE_SPEECH_KEY is not configured.');
  }

  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Accept': 'application/json',
      'User-Agent': 'BMC/2.1.1',
    },
  });

  if (!response.ok) {
    return {
      __diagnostic: {
        error: 'Azure rejected the voice catalog request.',
        upstreamStatus: response.status,
        upstreamStatusText: response.statusText,
        azureErrorCode: response.headers.get('x-ms-error-code') || null,
        region,
        keyPresent: true,
        keyLength: key.length,
      },
    };
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

  const region = (process.env.AZURE_SPEECH_REGION || '')
    .trim()
    .replace(/^Value:\s*/i, '');
  const key = (process.env.AZURE_SPEECH_KEY || '').trim();
  const cacheKey = `azure-voices:${region}`;
  const currentCache = globalThis.__bmcVoiceCache || {};

  if (!key || !region) {
    return jsonResponse({
      error: 'Azure Speech configuration is incomplete.',
      region,
      keyPresent: !!key,
    }, 500);
  }

  if (currentCache[cacheKey] && currentCache[cacheKey].expiresAt > Date.now()) {
    return jsonResponse(currentCache[cacheKey].data, 200, {
      'Cache-Control': 'public, max-age=21600',
    });
  }

  try {
    const catalog = await getVoiceCatalog(region, key);

    if (catalog && catalog.__diagnostic) {
      return jsonResponse(catalog.__diagnostic, 502);
    }

    globalThis.__bmcVoiceCache = globalThis.__bmcVoiceCache || {};
    globalThis.__bmcVoiceCache[cacheKey] = {
      data: catalog,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return jsonResponse(catalog, 200, {
      'Cache-Control': 'public, max-age=21600',
    });
  } catch (error) {
    return jsonResponse({
      error: 'Azure could not be reached.',
      cause: error.message,
      region,
      keyPresent: true,
      keyLength: key.length,
    }, 502);
  }
};
