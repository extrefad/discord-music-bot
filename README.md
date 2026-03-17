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
- @discordjs/voice
- play-dl
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

Copie o arquivo de exemplo e ajuste os valores:

```bash
cp .env.example .env
```

Depois edite o `.env` na raiz:

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
PREFIX=/
LEAVE_ON_EMPTY_COOLDOWN_MS=120000
YOUTUBE_API_KEY=
YOUTUBE_COOKIES=
YOUTUBE_COOKIES_FILE=
```

> `GUILD_ID` é opcional, mas recomendado no desenvolvimento para propagação instantânea dos comandos.

## Instalação

```bash
npm install
npm start
```

## Comandos

- `/tocar busca:<nome/link>`
- `/pausar`
- `/retomar`
- `/pular`
- `/parar`
- `/fila`
- `/tocando`
- `/volume nivel:<1-150>`
- `/repetir modo:<desativado|musica|fila>`
- `/embaralhar`
- `/sair`
- `/ajuda`
- `/ping`

## Modo contingência (play-dl)

- O bot usa `play-dl` como player principal para reduzir falhas de extração no YouTube.
- Para reduzir erro de conexão em voz, garanta permissões **Conectar** e **Falar** no canal.

## Observações de produção local (PC como servidor)

- Deixe o processo rodando com PM2/NSSM/Task Scheduler.
- Use Node 22 LTS.
- Mantenha `ffmpeg-static` e dependências nativas atualizadas.
- Para 100+ servidores, monitore RAM/CPU e habilite restart policy.


## Solução rápida de erros comuns

- **Erro `Missing required environment variables`**
  - Você ainda não configurou o `.env` corretamente.
  - Preencha `DISCORD_TOKEN` e `CLIENT_ID` (obrigatórios).

- **Aviso sobre `npm audit`**
  - Esses avisos não impedem o bot de iniciar.
  - Só rode `npm audit fix --force` se você aceitar mudanças potencialmente quebráveis nas dependências.

- **Erro ao conectar no canal de voz (timeout de 30s)**
  - Verifique se o bot tem permissões **Conectar** e **Falar** no canal.
  - Verifique se o canal não está lotado.

