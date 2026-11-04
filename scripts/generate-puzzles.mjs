import { readFile, writeFile, rename } from 'node:fs/promises';
import { countSolutions, generateSolution, ratePuzzle } from '../src/sudoku.mjs';

// Append only: published IDs must continue to address exactly the same puzzle.
// Reproducible independent generation; no puzzle bank or external requests.
const seed = Number(process.env.SUDOKU_SEED || 20261104);
const target = Number(process.env.SUDOKU_TOTAL || 500);
if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(target) || target < 100 || target % 100) {
  throw new Error('SUDOKU_SEED must be an integer; SUDOKU_TOTAL must be a positive multiple of 100.');
}
const destination = new URL('../puzzles.json', import.meta.url);
const original = await readFile(destination, 'utf8');
const existing = JSON.parse(original);
if (!Array.isArray(existing) || existing.some((puzzle, index) => !puzzle || puzzle.id !== index + 1 || !/^[0-9]{81}$/.test(puzzle.givens) || !/^[1-9]{81}$/.test(puzzle.solution) || !Number.isInteger(puzzle.level) || puzzle.level < 5 || puzzle.level > 10)) {
  throw new Error('Existing collection is malformed; refusing to change published puzzles.');
}
if (existing.length >= target) {
  console.log(`Kept all ${existing.length} published puzzles; target ${target} already reached.`);
  process.exit(0);
}
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
const quotas = Object.fromEntries(Object.entries({ 5: 20, 6: 20, 7: 20, 8: 15, 9: 15, 10: 10 }).map(([level, count]) => [level, count * target / 100]));
const publishedCounts = Object.fromEntries(Object.keys(quotas).map((level) => [level, existing.filter((puzzle) => puzzle.level === Number(level)).length]));
if (Object.keys(quotas).some((level) => publishedCounts[level] > quotas[level])) throw new Error('Target distribution would require replacing published puzzles; choose a larger SUDOKU_TOTAL.');
const buckets = Object.fromEntries(Object.keys(quotas).map((level) => [level, []]));
const seen = new Set(existing.map((puzzle) => puzzle.givens));
const seenSolutions = new Set(existing.map((puzzle) => puzzle.solution));
if (seen.size !== existing.length || seenSolutions.size !== existing.length) throw new Error('Published collection contains duplicate grids.');
const start = Date.now();
let attempt = 0;
while (Object.keys(quotas).some((level) => publishedCounts[level] + buckets[level].length < quotas[level])) {
  if (++attempt > target * 150) throw new Error(`Could not fill quotas: ${JSON.stringify(Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, publishedCounts[key] + value.length])))}`);
  const solution = generateSolution(random);
  const board = [...solution];
  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    const value = board[index]; board[index] = 0;
    if (countSolutions(board) !== 1) board[index] = value;
  }
  const rating = ratePuzzle(board);
  const level = rating.level;
  const givens = board.join('');
  const answer = solution.join('');
  if (buckets[level] && publishedCounts[level] + buckets[level].length < quotas[level] && !seen.has(givens) && !seenSolutions.has(answer)) {
    buckets[level].push({ level, givens, solution: answer, rating });
    seen.add(givens);
    seenSolutions.add(answer);
  }
  if (attempt % 100 === 0) console.log(`Generated ${attempt}: ${JSON.stringify(Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, publishedCounts[key] + value.length])))}, ${((Date.now() - start) / 1000).toFixed(1)}s`);
}
const additions = Object.keys(quotas).flatMap((level) => buckets[level]).map((puzzle, index) => ({ id: existing.length + index + 1, ...puzzle }));
const puzzles = [...existing, ...additions];
// Another author may have appended while generation ran. Never overwrite that work.
if (await readFile(destination, 'utf8') !== original) throw new Error('Collection changed during generation; no output written.');
const temporary = new URL('../puzzles.json.tmp', import.meta.url);
await writeFile(temporary, `${JSON.stringify(puzzles, null, 2)}\n`);
await rename(temporary, destination);
console.log(`Preserved ${existing.length} puzzles and appended ${additions.length}: ${puzzles.length} total from ${attempt} independent grids (${((Date.now() - start) / 1000).toFixed(1)}s), seed ${seed}.`);
