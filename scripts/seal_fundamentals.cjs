// The encrypted output can be served by a static host. Keep the key file private.
const fs = require('node:fs');
const { randomBytes, createCipheriv } = require('node:crypto');
const { gzipSync } = require('node:zlib');

const [input, keyFile, output] = process.argv.slice(2);
if (!input || !keyFile || !output) throw new Error('Usage: seal_fundamentals.cjs input.json private-key.txt statements.bin');
if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, randomBytes(32).toString('base64url') + '\n', { flag: 'wx', mode: 0o600 });
const key = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64url');
if (key.length !== 32) throw new Error('Expected a 256-bit archive key');
const nonce = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, nonce);
const ciphertext = Buffer.concat([cipher.update(gzipSync(fs.readFileSync(input), { level: 9 })), cipher.final()]);
fs.writeFileSync(output, Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]));
