class Track {
  constructor(song) {
    this.id = song.id || song.url;
    this.name = song.name;
    this.url = song.url;
    this.duration = song.duration;
    this.formattedDuration = song.formattedDuration;
    this.thumbnail = song.thumbnail;
    this.requestedBy = song.user?.username || song.user?.displayName || 'Unknown';
    this.source = song.source;
  }

  static fromSong(song) {
    return new Track(song);
  }
}

module.exports = { Track };
