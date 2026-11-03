import { writeFile } from 'node:fs/promises';
import { countSolutions, generateSolution, ratePuzzle } from '../src/sudoku.mjs';

// Reproducible independent generation; no puzzle bank or external requests.
const seed = Number(process.env.SUDOKU_SEED || 20261103);
let randomState = seed;
function random() {
  randomState += 0x6d2b79f5;
  let value = randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
function shuffle(values) {
  const output = [...values];
  for (let i = output.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
}
const quotas = { 5: 20, 6: 20, 7: 20, 8: 15, 9: 15, 10: 10 };
const buckets = Object.fromEntries(Object.keys(quotas).map((level) => [level, []]));
const seen = new Set();
const start = Date.now();
let attempt = 0;
while (Object.keys(quotas).some((level) => buckets[level].length < quotas[level])) {
  if (++attempt > 15000) throw new Error(`Could not fill quotas: ${JSON.stringify(Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, value.length])))}`);
  const solution = generateSolution(random);
  const board = [...solution];
  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    const value = board[index]; board[index] = 0;
    if (countSolutions(board) !== 1) board[index] = value;
  }
  const rating = ratePuzzle(board);
  const level = rating.level;
  const givens = board.join('');
  if (buckets[level] && buckets[level].length < quotas[level] && !seen.has(givens)) {
    buckets[level].push({ level, givens, solution: solution.join(''), rating });
    seen.add(givens);
  }
  if (attempt % 100 === 0) console.log(`Generated ${attempt}: ${JSON.stringify(Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, value.length])))}, ${((Date.now() - start) / 1000).toFixed(1)}s`);
}
const puzzles = Object.keys(quotas).flatMap((level) => buckets[level]).map((puzzle, index) => ({ id: index + 1, ...puzzle }));
await writeFile(new URL('../puzzles.json', import.meta.url), `${JSON.stringify(puzzles, null, 2)}\n`);
console.log(`Saved ${puzzles.length} puzzles from ${attempt} independent grids (${((Date.now() - start) / 1000).toFixed(1)}s), seed ${seed}.`);
