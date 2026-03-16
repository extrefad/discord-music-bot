const { SlashCommandBuilder } = require('discord.js');

const tocar = {
  data: new SlashCommandBuilder()
    .setName('tocar')
    .setDescription('Toca uma música local da pasta /music')
    .addStringOption((opt) =>
      opt.setName('musica').setDescription('Nome do arquivo (ou parte do nome)').setRequired(true)
    ),
  async execute(interaction, client) {
    await interaction.deferReply();

    const query = interaction.options.getString('musica').trim();
    const voiceChannel = interaction.member.voice?.channel;

    if (!voiceChannel) {
      await interaction.editReply('❌ Entre em um canal de voz primeiro.');
      return;
    }

    try {
      const result = await client.localPlayer.enqueue({
        guildId: interaction.guildId,
        voiceChannel,
        textChannel: interaction.channel,
        query,
        requestedBy: interaction.user.displayName ?? interaction.user.username,
      });

      if (!result.ok) {
        await interaction.editReply('❌ Música não encontrada na biblioteca local. Use `/biblioteca` para listar os arquivos.');
        return;
      }

      if (result.nowPlaying) {
        await interaction.editReply(`🎵 Reproduzindo **${result.track.fileName}**`);
      } else {
        await interaction.editReply(`✅ Adicionada à fila: **${result.track.fileName}** (posição ${result.position})`);
      }
    } catch (error) {
      console.error('Erro /tocar:', error.message);
      await interaction.editReply('❌ Falha ao tocar o arquivo local.');
    }
  },
};

const biblioteca = {
  data: new SlashCommandBuilder().setName('biblioteca').setDescription('Lista as músicas locais disponíveis'),
  async execute(interaction, client) {
    const library = client.localPlayer.getLibrary();
    if (!library.length) {
      await interaction.reply('📁 Biblioteca vazia. Adicione arquivos em `src/music`.');
      return;
    }

    const preview = library.slice(0, 20).map((name, i) => `> ${i + 1}. ${name}`);
    const suffix = library.length > 20 ? `\n> ...e mais ${library.length - 20} arquivo(s)` : '';
    await interaction.reply(`📚 **Biblioteca local (${library.length})**\n${preview.join('\n')}${suffix}`);
  },
};

const pausar = {
  data: new SlashCommandBuilder().setName('pausar').setDescription('Pausa ou retoma a reprodução'),
  async execute(interaction, client) {
    const result = client.localPlayer.togglePause(interaction.guildId);
    if (!result.ok) {
      await interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
      return;
    }

    await interaction.reply(result.paused ? '⏸️ Pausado.' : '▶️ Retomado.');
  },
};

const pular = {
  data: new SlashCommandBuilder().setName('pular').setDescription('Pula para a próxima música da fila'),
  async execute(interaction, client) {
    const current = client.localPlayer.getCurrent(interaction.guildId);
    const result = client.localPlayer.skip(interaction.guildId);
    if (!result.ok) {
      await interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
      return;
    }

    await interaction.reply(`⏭️ Pulando **${current.fileName}**`);
  },
};

const parar = {
  data: new SlashCommandBuilder().setName('parar').setDescription('Para o player e limpa a fila'),
  async execute(interaction, client) {
    client.localPlayer.stop(interaction.guildId);
    await interaction.reply('⏹️ Reprodução parada e fila limpa.');
  },
};

const fila = {
  data: new SlashCommandBuilder().setName('fila').setDescription('Mostra a fila local'),
  async execute(interaction, client) {
    const queue = client.localPlayer.getQueue(interaction.guildId);
    if (!queue.length) {
      await interaction.reply({ content: '❌ A fila está vazia.', ephemeral: true });
      return;
    }

    const lines = queue.slice(0, 11).map((track, index) => {
      if (index === 0) return `> 🎵 **Agora:** ${track.fileName}`;
      return `> ${index}. ${track.fileName}`;
    });

    if (queue.length > 11) lines.push(`> ...e mais ${queue.length - 11} música(s)`);

    await interaction.reply(`📋 **Fila local (${queue.length})**\n${lines.join('\n')}`);
  },
};

const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajusta o volume (0-100)')
    .addIntegerOption((opt) =>
      opt.setName('nivel').setDescription('Volume entre 0 e 100').setMinValue(0).setMaxValue(100).setRequired(true)
    ),
  async execute(interaction, client) {
    const nivel = interaction.options.getInteger('nivel');
    client.localPlayer.setVolume(interaction.guildId, nivel);
    await interaction.reply(`🔊 Volume ajustado para **${nivel}%**`);
  },
};

const loop = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Define o modo de loop da fila local')
    .addStringOption((opt) =>
      opt
        .setName('modo')
        .setDescription('Modo de loop')
        .setRequired(true)
        .addChoices(
          { name: '🔁 Música atual', value: 'track' },
          { name: '🔁 Fila inteira', value: 'queue' },
          { name: '⛔ Desativado', value: 'off' }
        )
    ),
  async execute(interaction, client) {
    const modo = interaction.options.getString('modo');
    client.localPlayer.setLoopMode(interaction.guildId, modo);
    await interaction.reply(`✅ Loop ajustado para: **${modo}**`);
  },
};

const embaralhar = {
  data: new SlashCommandBuilder().setName('embaralhar').setDescription('Embaralha a fila (mantém a atual no topo)'),
  async execute(interaction, client) {
    const changed = client.localPlayer.shuffle(interaction.guildId);
    if (!changed) {
      await interaction.reply({ content: '❌ Fila pequena demais para embaralhar.', ephemeral: true });
      return;
    }

    await interaction.reply('🔀 Fila embaralhada.');
  },
};

const tocando = {
  data: new SlashCommandBuilder().setName('tocando').setDescription('Mostra a música local atual'),
  async execute(interaction, client) {
    const current = client.localPlayer.getCurrent(interaction.guildId);
    if (!current) {
      await interaction.reply({ content: '❌ Nenhuma música tocando.', ephemeral: true });
      return;
    }

    await interaction.reply(`🎵 Tocando agora: **${current.fileName}**`);
  },
};

module.exports = [tocar, biblioteca, pausar, pular, parar, fila, volume, loop, embaralhar, tocando];
