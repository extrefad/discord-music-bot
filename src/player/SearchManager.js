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
}

module.exports = { SearchManager };
