const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const MODEL_DIR = path.join(__dirname, 'vosk-model');
const MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip';
const ZIP_FILE  = path.join(__dirname, 'vosk-model.zip');

if (fs.existsSync(MODEL_DIR)) {
  console.log('Modelo Vosk ja existe, pulando download.');
  process.exit(0);
}

console.log('Baixando modelo de voz (~31MB)...');

function download(url, dest, cb) {
  const file = fs.createWriteStream(dest);
  https.get(url, res => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      return download(res.headers.location, dest, cb);
    }
    res.pipe(file);
    file.on('finish', () => { file.close(); cb(); });
  }).on('error', err => { fs.unlink(dest, () => {}); console.error(err); process.exit(1); });
}

download(MODEL_URL, ZIP_FILE, () => {
  console.log('Extraindo modelo...');
  execSync(`unzip -o "${ZIP_FILE}" -d "${__dirname}"`);
  const ex = fs.readdirSync(__dirname)
    .find(f => f.startsWith('vosk-model-small-pt') && fs.statSync(path.join(__dirname,f)).isDirectory());
  if (ex && ex !== 'vosk-model') fs.renameSync(path.join(__dirname, ex), MODEL_DIR);
  fs.unlinkSync(ZIP_FILE);
  console.log('Modelo pronto!');
});