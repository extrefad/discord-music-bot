const { Manager } = require("erela.js");

module.exports = (client) => {

  const manager = new Manager({
    nodes: [
      {
        host: "lavalink4.serenetia.com",
        port: 443,
        password: "serenetia",
        secure: true
      }
    ],
    send(id, payload) {
      const guild = client.guilds.cache.get(id);
      if (guild) guild.shard.send(payload);
    }
  });

  client.manager = manager;

  client.on("raw", (d) => manager.updateVoiceState(d));

  manager.on("nodeConnect", node => {
    console.log("Lavalink conectado");
  });

  manager.on("nodeError", (node, error) => {
    console.log("Erro Lavalink:", error);
  });

};