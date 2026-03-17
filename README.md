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

## Observações de produção local (PC como servidor)

- Deixe o processo rodando com PM2/NSSM/Task Scheduler.
- Use Node 22 LTS.
- Mantenha `ffmpeg-static` e dependências nativas atualizadas.
- Para 100+ servidores, monitore RAM/CPU e habilite restart policy.


## Solução rápida de erros comuns

- **Erro `Missing required environment variables`**
  - Você ainda não configurou o `.env` corretamente.
  - Preencha `DISCORD_TOKEN` e `CLIENT_ID` (obrigatórios).

- **Erro `DisTubeError [INVALID_KEY]: emitEventsAfterFetching`**
  - Esse erro era causado por uma opção inválida no plugin do Spotify em versões atuais.
  - Já foi corrigido no código desta versão (uso de `new SpotifyPlugin()` sem essa chave).

- **Erro `DisTubeError [INVALID_KEY]: leaveOnStop`**
  - A versão atual do DisTube não aceita mais algumas chaves antigas (`leaveOnStop`, `leaveOnEmpty`, `leaveOnFinish`) em `DisTubeOptions`.
  - Já foi corrigido no código desta versão removendo essas chaves.


- **Aviso sobre `npm audit`**
  - Esses avisos não impedem o bot de iniciar.
  - Só rode `npm audit fix --force` se você aceitar mudanças potencialmente quebráveis nas dependências.

- **Erro `Failed to find any playable formats`**
  - Alguns links podem falhar por restrição do provedor/região/formato.
  - O bot agora tenta um fallback automático de busca (`ytsearch`) antes de desistir.
  - Se ainda falhar, tente outro link, usar termo de busca, ou vídeo alternativo.
