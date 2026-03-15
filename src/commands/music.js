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
    if (!voiceChannel) return interaction.editReply('Entre em um **canal de voz** primeiro!');
    try {
      await client.distube.play(voiceChannel, query, {
        textChannel: interaction.channel,
        member: interaction.member,
      });
      await interaction.editReply('Buscando: **' + query + '**...');
    } catch (err) {
      console.error('Erro /tocar:', err.message);
      await interaction.editReply('Nao encontrei nada para: **' + query + '**');
    }
  },
};

const pausar = {
  data: new SlashCommandBuilder().setName('pausar').setDescription('Pausa ou retoma a musica'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: 'Nenhuma musica tocando.', ephemeral: true });
    if (queue.paused) { queue.resume(); interaction.reply('Continuando!'); }
    else              { queue.pause();  interaction.reply('Pausado!'); }
  },
};

const pular = {
  data: new SlashCommandBuilder().setName('pular').setDescription('Pula para a proxima musica'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: 'Nenhuma musica tocando.', ephemeral: true });
    const title = queue.songs[0]?.name;
    try { await queue.skip(); interaction.reply('Pulado: **' + title + '**'); }
    catch { interaction.reply('Fila finalizada!'); }
  },
};

const parar = {
  data: new SlashCommandBuilder().setName('parar').setDescription('Para a musica e desconecta'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: 'Nenhuma musica tocando.', ephemeral: true });
    await client.distube.stop(interaction.guildId);
    interaction.reply('Musica parada e fila limpa!');
  },
};

const fila = {
  data: new SlashCommandBuilder().setName('fila').setDescription('Mostra a fila de musicas'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue?.songs?.length) return interaction.reply({ content: 'A fila esta vazia.', ephemeral: true });
    const lines = [];
    const cur = queue.songs[0];
    lines.push('**Tocando agora:**\n> ' + cur.name + ' (' + cur.formattedDuration + ')');
    if (queue.songs.length > 1) {
      lines.push('\n**Proximas:**');
      queue.songs.slice(1, 11).forEach((s, i) => lines.push('> ' + (i+1) + '. ' + s.name + ' (' + s.formattedDuration + ')'));
      if (queue.songs.length > 11) lines.push('> ...e mais ' + (queue.songs.length - 11));
    }
    interaction.reply(lines.join('\n'));
  },
};

const volume = {
  data: new SlashCommandBuilder()
    .setName('volume').setDescription('Ajusta o volume (0-100)')
    .addIntegerOption(opt => opt.setName('nivel').setDescription('0 a 100').setMinValue(0).setMaxValue(100).setRequired(true)),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: 'Nenhuma musica tocando.', ephemeral: true });
    const nivel = interaction.options.getInteger('nivel');
    queue.setVolume(nivel);
    interaction.reply('Volume: **' + nivel + '%**');
  },
};

const loop = {
  data: new SlashCommandBuilder()
    .setName('loop').setDescription('Ativa/desativa loop')
    .addStringOption(opt =>
      opt.setName('modo').setDescription('Modo').setRequired(true)
        .addChoices(
          { name: 'Musica atual', value: 'track' },
          { name: 'Fila inteira', value: 'queue' },
          { name: 'Desativar',    value: 'off'   }
        )
    ),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: 'Nenhuma musica tocando.', ephemeral: true });
    const modo = interaction.options.getString('modo');
    if (modo === 'track')      { queue.setRepeatMode(1); interaction.reply('Loop da musica atual ativado!'); }
    else if (modo === 'queue') { queue.setRepeatMode(2); interaction.reply('Loop da fila ativado!'); }
    else                       { queue.setRepeatMode(0); interaction.reply('Loop desativado!'); }
  },
};

const embaralhar = {
  data: new SlashCommandBuilder().setName('embaralhar').setDescription('Embaralha a fila'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue || queue.songs.length < 2) return interaction.reply({ content: 'Nao ha musicas suficientes.', ephemeral: true });
    queue.shuffle();
    interaction.reply('Fila embaralhada! (' + queue.songs.length + ' musicas)');
  },
};

const tocando = {
  data: new SlashCommandBuilder().setName('tocando').setDescription('Mostra a musica atual'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue?.songs?.[0]) return interaction.reply({ content: 'Nenhuma musica tocando.', ephemeral: true });
    const s = queue.songs[0];
    interaction.reply('Tocando agora:\n> **' + s.name + '**\n> ' + s.formattedDuration + ' | Proximas: ' + (queue.songs.length - 1));
  },
};

module.exports = [tocar, pausar, pular, parar, fila, volume, loop, embaralhar, tocando];