import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const directory = new URL('../.local-mailtrain/', import.meta.url);
await mkdir(directory, { recursive: true });
const tokenFile = new URL('token.txt', directory);
let token;
try { token = (await readFile(tokenFile, 'utf8')).trim(); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  token = randomBytes(32).toString('hex');
  await writeFile(tokenFile, token, { mode: 0o600, flag: 'wx' });
}
if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid local connection token.');
const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
// Replace only the declaration; preserve the guard against the template placeholder.
const personalized = source.replace("const MEAL_TRAIN_TOKEN = '__PRIVATE_TOKEN__';", 'const MEAL_TRAIN_TOKEN = ' + JSON.stringify(token) + ';');
await writeFile(new URL('MealTrain-Code.txt', directory), personalized, { mode: 0o600 });
console.log('Prepared .local-mailtrain/MealTrain-Code.txt. This private file is ignored by Git.');
