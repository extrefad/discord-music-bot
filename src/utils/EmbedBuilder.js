const { EmbedBuilder, Colors } = require('discord.js');

class EmbedFactory {
  static base(title, description, color = Colors.Blurple) {
    return new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  static success(title, description) {
    return this.base(title, description, Colors.Green);
  }

  static warning(title, description) {
    return this.base(title, description, Colors.Orange);
  }

  static error(title, description) {
    return this.base(title, description, Colors.Red);
  }

  static nowPlaying(song, requestedBy) {
    const embed = this.base('🎵 Tocando agora', `[${song.name}](${song.url})`, Colors.Blue)
      .addFields(
        { name: 'Duração', value: song.formattedDuration || 'Ao vivo', inline: true },
        { name: 'Pedido por', value: requestedBy || song.user?.toString() || 'Desconhecido', inline: true },
      )
      .setThumbnail(song.thumbnail || null);

    return embed;
  }
}

module.exports = { EmbedFactory };
