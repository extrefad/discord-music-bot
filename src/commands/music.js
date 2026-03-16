const { SlashCommandBuilder } = require('discord.js');

function getQueue(client, interaction) {

  const queue = client.distube.getQueue(interaction.guildId);

  if (!queue) {
    interaction.reply({
      content: '❌ Nenhuma música tocando.',
      ephemeral: true
    });
    return null;
  }

  return queue;
}

const tocar = {
  data: new SlashCommandBuilder()
    .setName('tocar')
    .setDescription('Toca uma música')
    .addStringOption(opt =>
      opt.setName('musica')
      .setDescription('Nome ou link da música')
      .setRequired(true)
    ),

  async execute(interaction, client) {

    await interaction.deferReply();

    const query = interaction.options.getString('musica');
    const voiceChannel = interaction.member.voice?.channel;

    if (!voiceChannel)
      return interaction.editReply('❌ Entre em um canal de voz primeiro!');

    try {

      await client.distube.play(voiceChannel, query, {
        textChannel: interaction.channel,
        member: interaction.member
      });

      interaction.editReply(`🔍 Buscando: **${query}**`);

    } catch (err) {

      console.error(err);
      interaction.editReply('❌ Não consegui tocar essa música.');

    }

  }
};


const pausar = {
  data: new SlashCommandBuilder().setName('pausar').setDescription('Pausa ou continua'),

  async execute(interaction, client) {

    const queue = getQueue(client, interaction);
    if (!queue) return;

    if (queue.paused) {
      queue.resume();
      interaction.reply('▶️ Música retomada');
    } else {
      queue.pause();
      interaction.reply('⏸️ Música pausada');
    }

  }
};


const pular = {
  data: new SlashCommandBuilder().setName('pular').setDescription('Pula a música'),

  async execute(interaction, client) {

    const queue = getQueue(client, interaction);
    if (!queue) return;

    try {

      await queue.skip();
      interaction.reply('⏭️ Música pulada');

    } catch {

      interaction.reply('⏭️ Fila acabou');

    }

  }
};


const parar = {
  data: new SlashCommandBuilder().setName('parar').setDescription('Para a música'),

  async execute(interaction, client) {

    const queue = getQueue(client, interaction);
    if (!queue) return;

    queue.stop();
    interaction.reply('⏹️ Música parada');

  }
};


const fila = {
  data: new SlashCommandBuilder().setName('fila').setDescription('Mostra a fila'),

  async execute(interaction, client) {

    const queue = getQueue(client, interaction);
    if (!queue) return;

    const songs = queue.songs.map((s, i) =>
      `${i === 0 ? '🎵 Tocando:' : `${i}.`} ${s.name}`
    );

    interaction.reply(songs.slice(0, 10).join('\n'));

  }
};


const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Define o volume')
    .addIntegerOption(o =>
      o.setName('nivel')
      .setDescription('0 a 100')
      .setRequired(true)
    ),

  async execute(interaction, client) {

    const queue = getQueue(client, interaction);
    if (!queue) return;

    const nivel = interaction.options.getInteger('nivel');

    queue.setVolume(nivel);

    interaction.reply(`🔊 Volume: **${nivel}%**`);

  }
};


module.exports = [
  tocar,
  pausar,
  pular,
  parar,
  fila,
  volume
];