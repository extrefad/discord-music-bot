class SearchManager {
  static normalizeQuery(query) {
    return String(query || '').trim();
  }

  static detectSource(query) {
    const q = this.normalizeQuery(query);
    if (/spotify\.com/i.test(q)) return 'spotify';
    if (/youtu\.be|youtube\.com/i.test(q)) return 'youtube';
    if (/^https?:\/\//i.test(q)) return 'url';
    return 'search';
  }

  static async resolveQuery(query, config, logger) {
    const normalized = this.normalizeQuery(query);
    const source = this.detectSource(normalized);

    if (source !== 'search' || !config?.youtubeApiKey) {
      return normalized;
    }

    try {
      const endpoint = new URL('https://www.googleapis.com/youtube/v3/search');
      endpoint.searchParams.set('part', 'snippet');
      endpoint.searchParams.set('q', normalized);
      endpoint.searchParams.set('maxResults', '1');
      endpoint.searchParams.set('type', 'video');
      endpoint.searchParams.set('key', config.youtubeApiKey);

      const response = await fetch(endpoint);
      if (!response.ok) return normalized;

      const payload = await response.json();
      const videoId = payload?.items?.[0]?.id?.videoId;
      if (!videoId) return normalized;

      const resolved = `https://www.youtube.com/watch?v=${videoId}`;
      logger?.info('Busca resolvida via YouTube API', { original: normalized, resolved });
      return resolved;
    } catch (error) {
      logger?.warn('Falha ao resolver via YouTube API, mantendo busca original', {
        error: error?.message || 'Erro desconhecido',
      });
      return normalized;
    }
  }
}

module.exports = { SearchManager };
