import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { candidates, countSolutions, solve, ratePuzzle, ROWS, COLS, BOXES } from '../src/sudoku.mjs';

const puzzles = JSON.parse(await readFile(new URL('../puzzles.json', import.meta.url), 'utf8'));
test('100 independent puzzles cover levels 5–10 in the specified distribution', () => {
  assert.equal(puzzles.length, 100);
  assert.equal(new Set(puzzles.map((puzzle) => puzzle.givens)).size, 100);
  assert.equal(new Set(puzzles.map((puzzle) => puzzle.solution)).size, 100);
  assert.deepEqual(puzzles.map((puzzle) => puzzle.id), Array.from({ length: 100 }, (_, i) => i + 1));
  const distribution = puzzles.reduce((counts, puzzle) => { counts[puzzle.level] = (counts[puzzle.level] || 0) + 1; return counts; }, {});
  assert.deepEqual(distribution, { 5: 20, 6: 20, 7: 20, 8: 15, 9: 15, 10: 10 });
});
for (const puzzle of puzzles) {
  test(`puzzle ${puzzle.id} has one solution, valid rows/columns/boxes, and reproducible level ${puzzle.level}`, () => {
    assert.match(puzzle.givens, /^[0-9]{81}$/);
    assert.match(puzzle.solution, /^[1-9]{81}$/);
    const board = Array.from(puzzle.givens, Number);
    const solution = Array.from(puzzle.solution, Number);
    assert.equal(countSolutions(board, 2), 1);
    assert.deepEqual(solve(board), solution);
    assert.equal(board.join(''), puzzle.givens, 'solver must not mutate its input');
    board.forEach((value, index) => { if (value) assert.equal(value, solution[index]); });
    for (const unit of [...ROWS, ...COLS, ...BOXES]) assert.equal(unit.map((i) => solution[i]).sort().join(''), '123456789');
    assert.deepEqual(ratePuzzle(board), puzzle.rating);
    assert.equal(puzzle.rating.level, puzzle.level);
    assert.ok(puzzle.rating.lockedCandidates || puzzle.rating.nakedPairs || puzzle.rating.remainingAfterLogic, 'level 5+ needs more than singles');
    for (let i = 0; i < 81; i++) if (!board[i]) assert.ok(candidates(board, i).includes(solution[i]));
  });
}
test('invalid or contradictory inputs are rejected without mutation', () => {
  const invalid = Array(81).fill(0); invalid[0] = 1; invalid[1] = 1;
  assert.equal(countSolutions(invalid), 0);
  assert.equal(solve(invalid), null);
  assert.deepEqual(candidates(invalid, 2), []);
  assert.equal(solve([0]), null);
  assert.equal(countSolutions(Array(81).fill(-1)), 0);
  assert.deepEqual(candidates(puzzles[0].givens, -1), []);
  assert.equal(countSolutions(Array(81).fill(0), 2), 2);
});
