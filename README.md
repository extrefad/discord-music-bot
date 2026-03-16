# Discord Music Bot (100% offline para Windows)

Este bot foi reestruturado para tocar **apenas arquivos locais**, sem YouTube/Spotify e sem streaming externo.

## O que mudou

- Removido DisTube e integração online.
- Player próprio baseado em `@discordjs/voice`.
- Biblioteca local em `src/music`.
- Comandos focados em uso offline no Windows.

## Requisitos (Windows)

- Node.js 18+
- FFmpeg disponível no sistema (ou use `ffmpeg-static`, já instalado como dependência)

## Instalação

```bash
npm install
```

## Configuração

Crie um `.env` na raiz:

```env
DISCORD_TOKEN=seu_token
CLIENT_ID=seu_client_id
GUILD_ID=seu_guild_id_opcional
```

## Biblioteca local

Coloque arquivos de áudio em:

```text
src/music
```

Formatos aceitos: `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`.

## Executar

```bash
npm start
```

## Comandos

- `/biblioteca` → lista músicas locais
- `/tocar musica:<nome>` → toca por nome (ou parte do nome)
- `/fila`, `/tocando`, `/pausar`, `/pular`, `/parar`
- `/volume nivel:<0-100>`
- `/loop modo:<track|queue|off>`
- `/embaralhar`

