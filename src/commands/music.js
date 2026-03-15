const { SlashCommandBuilder } = require('discord.js');

const tocar = {
  data: new SlashCommandBuilder()
    .setName('tocar')
    .setDescription('Toca uma musica — YouTube, Spotify ou nome')
    .addStringOption(opt =>
      opt.setName('musica').setDescription('Nome, link do YouTube ou Spotify').setRequired(true)
    ),
  async execute(interaction, client) {
    await interaction.deferReply();
    const query        = interaction.options.getString('musica').trim();
    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) return interaction.editReply('❌ Entre em um **canal de voz** primeiro!');
    try {
      await client.distube.play(voiceChannel, query, {
        textChannel: interaction.channel,
        member: interaction.member,
      });
      await interaction.editReply('🔍 Buscando: **' + query + '**...');
    } catch (err) {
      console.error('Erro /tocar:', err.message);
      await interaction.editReply('❌ Não encontrei nada para: **' + query + '**\n> Tente o nome da música.');
    }
  },
};

const pausar = {
  data: new SlashCommandBuilder().setName('pausar').setDescription('Pausa ou retoma a musica'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    if (queue.paused) { queue.resume(); interaction.reply('▶️ **Continuando!**'); }
    else              { queue.pause();  interaction.reply('⏸️ **Pausado!**'); }
  },
};

const pular = {
  data: new SlashCommandBuilder().setName('pular').setDescription('Pula para a proxima musica'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    const title = queue.songs[0]?.name;
    try { await queue.skip(); interaction.reply('⏭️ Pulado: **' + title + '**'); }
    catch { interaction.reply('⏭️ Fila finalizada!'); }
  },
};

const parar = {
  data: new SlashCommandBuilder().setName('parar').setDescription('Para a musica e desconecta'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    await client.distube.stop(interaction.guildId);
    interaction.reply('⏹️ **Música parada e fila limpa!**');
  },
};

const fila = {
  data: new SlashCommandBuilder().setName('fila').setDescription('Mostra a fila de musicas'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue?.songs?.length) return interaction.reply({ content: '❌ A fila está vazia.', ephemeral: true });
    const lines = [];
    const cur = queue.songs[0];
    lines.push('**Tocando agora:**\n> 🎵 ' + cur.name + ' (' + cur.formattedDuration + ')');
    if (queue.songs.length > 1) {
      lines.push('\n**Próximas músicas:**');
      queue.songs.slice(1, 11).forEach((s, i) => {
        lines.push('> ' + (i + 1) + '. ' + s.name + ' (' + s.formattedDuration + ')');
      });
      if (queue.songs.length > 11) lines.push('> *...e mais ' + (queue.songs.length - 11) + ' música(s)*');
    }
    if (queue.repeatMode === 1) lines.push('\n🔁 Loop da música ativo');
    if (queue.repeatMode === 2) lines.push('\n🔁 Loop da fila ativo');
    interaction.reply(lines.join('\n'));
  },
};

const volume = {
  data: new SlashCommandBuilder()
    .setName('volume').setDescription('Ajusta o volume (0-100)')
    .addIntegerOption(opt =>
      opt.setName('nivel').setDescription('Volume de 0 a 100').setMinValue(0).setMaxValue(100).setRequired(true)
    ),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    const nivel = interaction.options.getInteger('nivel');
    queue.setVolume(nivel);
    const emoji = nivel === 0 ? '🔇' : nivel < 30 ? '🔈' : nivel < 70 ? '🔉' : '🔊';
    interaction.reply(emoji + ' Volume ajustado para **' + nivel + '%**');
  },
};

const loop = {
  data: new SlashCommandBuilder()
    .setName('loop').setDescription('Ativa/desativa loop')
    .addStringOption(opt =>
      opt.setName('modo').setDescription('Modo de loop').setRequired(true)
        .addChoices(
          { name: '🔁 Música atual', value: 'track' },
          { name: '🔁 Fila inteira', value: 'queue' },
          { name: '⛔ Desativar',    value: 'off'   }
        )
    ),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    const modo = interaction.options.getString('modo');
    if (modo === 'track')      { queue.setRepeatMode(1); interaction.reply('🔁 Loop da **música atual** ativado!'); }
    else if (modo === 'queue') { queue.setRepeatMode(2); interaction.reply('🔁 Loop da **fila inteira** ativado!'); }
    else                       { queue.setRepeatMode(0); interaction.reply('⛔ Loop **desativado**!'); }
  },
};

const embaralhar = {
  data: new SlashCommandBuilder().setName('embaralhar').setDescription('Embaralha a fila'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue || queue.songs.length < 2) return interaction.reply({ content: '❌ Não há músicas suficientes na fila.', ephemeral: true });
    queue.shuffle();
    interaction.reply('🔀 Fila embaralhada! (' + queue.songs.length + ' músicas)');
  },
};

const tocando = {
  data: new SlashCommandBuilder().setName('tocando').setDescription('Mostra a musica atual'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue?.songs?.[0]) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    const s = queue.songs[0];
    interaction.reply(
      '🎵 **Tocando agora:**\n> **' + s.name + '**\n> 👤 ' +
      (s.user?.displayName || '?') + ' | ⏱️ ' + s.formattedDuration +
      '\n> 📋 Próximas na fila: ' + (queue.songs.length - 1)
    );
  },
};

module.exports = [tocar, pausar, pular, parar, fila, volume, loop, embaralhar, tocando];