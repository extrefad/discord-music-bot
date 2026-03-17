const { Track } = require('./Track');

class QueueManager {
  constructor(distube) {
    this.distube = distube;
  }

  get(guildId) {
    return this.distube.getQueue(guildId);
  }

  getSummary(guildId) {
    const queue = this.get(guildId);
    if (!queue) return null;

    return {
      volume: queue.volume,
      paused: queue.paused,
      repeatMode: queue.repeatMode,
      autoplay: queue.autoplay,
      songs: queue.songs.map((song) => Track.fromSong(song)),
    };
  }

  clear(guildId) {
    const queue = this.get(guildId);
    if (!queue) return false;
    queue.stop();
    return true;
  }

  shuffle(guildId) {
    const queue = this.get(guildId);
    if (!queue || queue.songs.length <= 2) return false;
    queue.shuffle();
    return true;
  }
}

module.exports = { QueueManager };
