# Voxara Bot (Jockie-like) 🎵

Bot de música para Discord inspirado no comportamento do Jockie Music, executando **100% no seu PC** (sem Railway/host externo).

## Recursos

- Slash commands completas (`/play`, `/skip`, `/queue`, etc.)
- Sistema de fila por servidor (multi guild)
- Reprodução YouTube + Spotify links + busca por texto
- Logs estruturados (`[INFO]`, `[WARN]`, `[ERROR]`, `[MUSIC]`)
- Cooldown anti-spam por comando
- Reconexão/saída automática em canal vazio
- Arquitetura modular por camadas

## Stack

- Node.js 22+
- discord.js v14
- distube v5
- @distube/youtube
- @distube/spotify
- dotenv
- ffmpeg-static
- opusscript
- libsodium-wrappers
- prism-media

## Estrutura

```txt
src/
├ core/
│  ├ BotClient.js
│  ├ Config.js
│  └ Logger.js
├ events/
│  ├ error.js
│  ├ interactionCreate.js
│  ├ ready.js
│  └ voiceStateUpdate.js
├ commands/
│  ├ music/
│  │  ├ play.js
│  │  ├ pause.js
│  │  ├ resume.js
│  │  ├ skip.js
│  │  ├ stop.js
│  │  ├ queue.js
│  │  ├ nowplaying.js
│  │  ├ volume.js
│  │  ├ loop.js
│  │  ├ shuffle.js
│  │  └ disconnect.js
│  └ utility/
│     ├ help.js
│     └ ping.js
├ player/
│  ├ PlayerManager.js
│  ├ QueueManager.js
│  ├ SearchManager.js
│  └ Track.js
├ utils/
│  ├ CooldownManager.js
│  ├ EmbedBuilder.js
│  └ PermissionManager.js
└ index.js
```

## Configuração

Crie `.env` na raiz:

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
PREFIX=/
LEAVE_ON_EMPTY_COOLDOWN_MS=120000
```

> `GUILD_ID` é opcional, mas recomendado no desenvolvimento para propagação instantânea dos comandos.

## Instalação

```bash
npm install
npm start
```

## Comandos

- `/play query:<nome/link>`
- `/pause`
- `/resume`
- `/skip`
- `/stop`
- `/queue`
- `/nowplaying`
- `/volume value:<1-150>`
- `/loop mode:<off|song|queue>`
- `/shuffle`
- `/disconnect`
- `/help`
- `/ping`

## Observações de produção local (PC como servidor)

- Deixe o processo rodando com PM2/NSSM/Task Scheduler.
- Use Node 22 LTS.
- Mantenha `ffmpeg-static` e dependências nativas atualizadas.
- Para 100+ servidores, monitore RAM/CPU e habilite restart policy.
