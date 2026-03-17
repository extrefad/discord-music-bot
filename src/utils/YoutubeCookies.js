const fs = require('fs');

function parseCookieString(cookieHeader) {
  if (!cookieHeader) return [];

  return cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf('=');
      if (idx <= 0) return null;
      const name = entry.slice(0, idx).trim();
      const value = entry.slice(idx + 1).trim();
      if (!name) return null;
      return {
        domain: '.youtube.com',
        path: '/',
        secure: true,
        httpOnly: false,
        name,
        value,
      };
    })
    .filter(Boolean);
}

function parseNetscapeFile(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const cookies = [];

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 7) continue;

    const [domain, , path, secure, expires, name, value] = parts;
    cookies.push({
      domain,
      path,
      secure: String(secure).toUpperCase() === 'TRUE',
      expires: Number(expires) || undefined,
      httpOnly: false,
      name,
      value,
    });
  }

  return cookies;
}

function loadYoutubeCookies({ cookiesRaw, cookiesFile }) {
  if (cookiesRaw) {
    const parsed = parseCookieString(cookiesRaw);
    if (parsed.length) return parsed;
  }

  if (cookiesFile && fs.existsSync(cookiesFile)) {
    const content = fs.readFileSync(cookiesFile, 'utf8');

    if (content.includes('\t')) {
      const netscape = parseNetscapeFile(content);
      if (netscape.length) return netscape;
    }

    const fromString = parseCookieString(content);
    if (fromString.length) return fromString;
  }

  return [];
}

module.exports = { loadYoutubeCookies };
