require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } = require('discord.js');
const { DisTube } = require('distube');
const YtDlpPlugin = require('@distube/yt-dlp').default;

const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();


// ─────────────────────────────────────
// DISTUBE
// ─────────────────────────────────────

client.distube = new DisTube(client, {
  plugins: [
    new YtDlpPlugin()
  ]
});


// ─────────────────────────────────────
// EVENTOS DISTUBE
// ─────────────────────────────────────

client.distube
.on("playSong", (queue, song) => {

  queue.textChannel?.send(
`🎵 **Tocando agora**
> **${song.name}**
> ⏱️ ${song.formattedDuration}`
  )

})

.on("addSong", (queue, song) => {

  queue.textChannel?.send(
`✅ **${song.name}** adicionada à fila
> posição: ${queue.songs.length}`
  )

})

.on("finish", queue => {

  queue.textChannel?.send("Fila finalizada.")

})

.on("error", (channel, error) => {

  console.error(error)

  channel?.send("Erro ao tocar música.")

})


// ─────────────────────────────────────
// CARREGAR COMANDOS
// ─────────────────────────────────────

const commandsPath = path.join(__dirname, "commands")

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"))

const commandsJson = []

for (const file of commandFiles) {

  const mod = require(path.join(commandsPath, file))

  const list = Array.isArray(mod) ? mod : [mod]

  for (const cmd of list) {

    if (!cmd.data || !cmd.execute) continue

    client.commands.set(cmd.data.name, cmd)

    commandsJson.push(cmd.data.toJSON())

  }

}


// ─────────────────────────────────────
// STATUS
// ─────────────────────────────────────

const activities = [

  { name: "/tocar musica", type: ActivityType.Playing },
  { name: "Voxara Music Bot", type: ActivityType.Listening }

]

function rotateActivity(){

  const act = activities[Math.floor(Math.random() * activities.length)]

  client.user.setActivity(act.name,{ type: act.type })

}


// ─────────────────────────────────────
// READY
// ─────────────────────────────────────

client.once("clientReady", async () => {

  console.log("VOXARA ONLINE")

  try{

    const rest = new REST({version:"10"}).setToken(process.env.DISCORD_TOKEN)

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID)

    await rest.put(route,{ body: commandsJson })

    console.log("Comandos registrados:", commandsJson.length)

  }catch(err){

    console.error("Erro registrar comandos:", err)

  }

  rotateActivity()

  setInterval(rotateActivity,30000)

})


// ─────────────────────────────────────
// INTERAÇÕES
// ─────────────────────────────────────

client.on("interactionCreate", async interaction => {

  if(!interaction.isChatInputCommand()) return

  const command = client.commands.get(interaction.commandName)

  if(!command) return

  try{

    await command.execute(interaction, client)

  }catch(error){

    console.error(error)

    if(interaction.replied || interaction.deferred)
      interaction.followUp({content:"Erro executar comando",ephemeral:true})
    else
      interaction.reply({content:"Erro executar comando",ephemeral:true})

  }

})


// ─────────────────────────────────────

client.login(process.env.DISCORD_TOKEN)