import {writeFile} from 'node:fs/promises';
import {solveLights, toggleBoard} from '../games/lights-engine.mjs';

let seed = 2026110417;
const random = () => { seed += 0x6d2b79f5; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const puzzles = [];
for (const size of [3, 4, 5]) {
  const candidates = [], seen = new Set();
  for (let attempt = 0; candidates.length < 100; attempt++) {
    if (attempt > 100000) throw new Error(`Could not produce ${size}x${size} collection.`);
    let board = Array(size * size).fill(0);
    for (let index = 0; index < board.length; index++) if (random() < .5) board = toggleBoard(board, size, index);
    const key = board.join('');
    if (seen.has(key)) continue;
    const solution = solveLights(board, size);
    if (!solution || solution.length < 2) continue;
    candidates.push({size, board, par: solution.length}); seen.add(key);
  }
  candidates.sort((a, b) => a.par - b.par || a.board.join('').localeCompare(b.board.join('')));
  for (const puzzle of candidates) puzzles.push({id: `lo${String(puzzles.length + 1).padStart(3, '0')}`, ...puzzle});
}
const destination = new URL('../games/lights-puzzles.mjs', import.meta.url);
let published = [];
try { published = (await import(destination.href)).PUZZLES; } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
for (let i = 0; i < published.length; i++) if (JSON.stringify(published[i]) !== JSON.stringify(puzzles[i])) throw new Error(`Published puzzle ${published[i].id} changed; refusing overwrite.`);
if (published.length === puzzles.length) console.log(`Kept ${published.length} published Lights Out puzzles unchanged.`);
else {
  await writeFile(destination, `// Original fixed-seed cross-shaped puzzles. Preserve released IDs and boards.\nexport const PUZZLES = ${JSON.stringify(puzzles)};\nexport default PUZZLES;\n`);
  console.log(`Saved ${puzzles.length} solvable puzzles, 100 each of 3x3, 4x4 and 5x5.`);
}
