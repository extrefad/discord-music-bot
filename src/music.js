const { SlashCommandBuilder } = require('discord.js');

const pausar = {
  data: new SlashCommandBuilder().setName('pausar').setDescription('Pausa ou retoma a música'),
  async execute(interaction, client) {
    const queue = client.musicQueues.get(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    if (queue.isPaused()) { queue.resume(); interaction.reply('▶️ **Continuando!**'); }
    else { queue.pause(); interaction.reply('⏸️ **Pausado!**'); }
  },
};

const pular = {
  data: new SlashCommandBuilder().setName('pular').setDescription('Pula para a próxima música'),
  async execute(interaction, client) {
    const queue = client.musicQueues.get(interaction.guildId);
    if (!queue || !queue.current) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    const skipped = queue.current.title;
    queue.skip();
    interaction.reply(`⏭️ Pulado: **${skipped}**`);
  },
};

const parar = {
  data: new SlashCommandBuilder().setName('parar').setDescription('Para a música e desconecta o bot'),
  async execute(interaction, client) {
    const queue = client.musicQueues.get(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    queue.stop(); queue.destroy();
    client.musicQueues.delete(interaction.guildId);
    interaction.reply('⏹️ **Música parada e fila limpa!**');
  },
};

const fila = {
  data: new SlashCommandBuilder().setName('fila').setDescription('Mostra a fila de músicas'),
  async execute(interaction, client) {
    const queue = client.musicQueues.get(interaction.guildId);
    if (!queue || (!queue.current && queue.tracks.length === 0)) {
      return interaction.reply({ content: '❌ A fila está vazia.', ephemeral: true });
    }
    const lines = [];
    if (queue.current) {
      lines.push(`**Tocando agora:**\n> 🎵 ${queue.current.title} (${queue.current.duration})`);
    }
    if (queue.tracks.length > 0) {
      lines.push(`\n**Próximas músicas:**`);
      queue.tracks.slice(0, 10).forEach((t, i) => {
        lines.push(`> ${i + 1}. ${t.title} (${t.duration}) — ${t.requestedBy}`);
      });
      if (queue.tracks.length > 10) lines.push(`> *...e mais ${queue.tracks.length - 10} música(s)*`);
    }
    const flags = [];
    if (queue.loop) flags.push('🔁 Loop');
    if (queue.loopQueue) flags.push('🔁 Loop da fila');
    if (flags.length) lines.push(`\n${flags.join(' | ')}`);
    interaction.reply(lines.join('\n'));
  },
};

const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajusta o volume (0-100)')
    .addIntegerOption(opt =>
      opt.setName('nivel').setDescription('Volume de 0 a 100').setMinValue(0).setMaxValue(100).setRequired(true)
    ),
  async execute(interaction, client) {
    const queue = client.musicQueues.get(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    const nivel = interaction.options.getInteger('nivel');
    queue.setVolume(nivel);
    const emoji = nivel === 0 ? '🔇' : nivel < 30 ? '🔈' : nivel < 70 ? '🔉' : '🔊';
    interaction.reply(`${emoji} Volume ajustado para **${nivel}%**`);
  },
};

const loop = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Ativa/desativa loop')
    .addStringOption(opt =>
      opt.setName('modo').setDescription('Modo de loop').setRequired(true)
        .addChoices(
          { name: '🔁 Música atual', value: 'track' },
          { name: '🔁 Fila inteira', value: 'queue' },
          { name: '⛔ Desativar',    value: 'off'   }
        )
    ),
  async execute(interaction, client) {
    const queue = client.musicQueues.get(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    const modo = interaction.options.getString('modo');
    if (modo === 'track')      { queue.loop = true;  queue.loopQueue = false; interaction.reply('🔁 Loop da **música atual** ativado!'); }
    else if (modo === 'queue') { queue.loopQueue = true; queue.loop = false; interaction.reply('🔁 Loop da **fila inteira** ativado!'); }
    else                       { queue.loop = false; queue.loopQueue = false; interaction.reply('⛔ Loop **desativado**!'); }
  },
};

const embaralhar = {
  data: new SlashCommandBuilder().setName('embaralhar').setDescription('Embaralha a fila'),
  async execute(interaction, client) {
    const queue = client.musicQueues.get(interaction.guildId);
    if (!queue || queue.tracks.length < 2) return interaction.reply({ content: '❌ Não há músicas suficientes na fila.', ephemeral: true });
    queue.shuffle();
    interaction.reply(`🔀 Fila embaralhada! (${queue.tracks.length} músicas)`);
  },
};

const tocando = {
  data: new SlashCommandBuilder().setName('tocando').setDescription('Mostra a música atual'),
  async execute(interaction, client) {
    const queue = client.musicQueues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
    const t = queue.current;
    interaction.reply(`🎵 **Tocando agora:**\n> **${t.title}**\n> 👤 ${t.requestedBy} | ⏱️ ${t.duration}\n> 📋 Próximas na fila: ${queue.tracks.length}`);
  },
};

module.exports = [pausar, pular, parar, fila, volume, loop, embaralhar, tocando];
