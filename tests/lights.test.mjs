import test from 'node:test';
import assert from 'node:assert/strict';
import {PUZZLES} from '../games/lights-puzzles.mjs';
import {affectedCells, toggleBoard, solveLights, createGame, press, undo, serializeGame, isComplete} from '../games/lights-engine.mjs';

// Independent row-chasing solver. Once the first row of presses is chosen,
// each later row is forced by the light directly above it. This does not use
// the production GF(2) solver or its neighbourhood helper.
function chase(board, size) {
  let shortest = null;
  for (let first = 0; first < 2 ** size; first++) {
    const cells = board.slice(), moves = [];
    const click = (r, c) => {
      moves.push(r * size + c);
      for (let nr = 0; nr < size; nr++) for (let nc = 0; nc < size; nc++) if (Math.abs(nr - r) + Math.abs(nc - c) <= 1) cells[nr * size + nc] ^= 1;
    };
    for (let c = 0; c < size; c++) if (first & (1 << c)) click(0, c);
    for (let r = 1; r < size; r++) for (let c = 0; c < size; c++) if (cells[(r - 1) * size + c]) click(r, c);
    if (cells.every(v => !v) && (!shortest || moves.length < shortest.length)) shortest = moves;
  }
  return shortest;
}
const apply = (board, size, moves) => moves.reduce((current, index) => toggleBoard(current, size, index), board);

test('300 distinct nontrivial boards are solvable and their minimum par matches independent row chasing', () => {
  assert.equal(PUZZLES.length, 300);
  assert.deepEqual([3, 4, 5].map(size => PUZZLES.filter(p => p.size === size).length), [100, 100, 100]);
  assert.deepEqual(PUZZLES.map(p => p.id), Array.from({length:300}, (_, i) => `lo${String(i + 1).padStart(3, '0')}`));
  assert.equal(new Set(PUZZLES.map(p => `${p.size}:${p.board.join('')}`)).size, 300);
  for (const puzzle of PUZZLES) {
    assert.equal(puzzle.board.length, puzzle.size ** 2); assert.ok(puzzle.board.every(v => v === 0 || v === 1));
    assert.ok(!isComplete(puzzle.board)); assert.ok(puzzle.par >= 2);
    const solution = solveLights(puzzle.board, puzzle.size), independent = chase(puzzle.board, puzzle.size);
    assert.ok(solution, puzzle.id); assert.ok(independent, puzzle.id);
    assert.equal(solution.length, independent.length, `${puzzle.id}: shortest press count`); assert.equal(solution.length, puzzle.par);
    assert.ok(isComplete(apply(puzzle.board, puzzle.size, solution)), puzzle.id);
  }
  for (const size of [3, 4, 5]) {
    const pars = PUZZLES.filter(p => p.size === size).map(p => p.par);
    assert.deepEqual(pars, pars.slice().sort((a, b) => a - b));
  }
});
test('GF(2) solver agrees with an independent solver for all 512 small boards', () => {
  for (let mask = 0; mask < 512; mask++) {
    const board = Array.from({length:9}, (_, i) => (mask >>> i) & 1), before = board.slice();
    const result = solveLights(board, 3), independent = chase(board, 3);
    assert.equal(result?.length, independent?.length); assert.ok(isComplete(apply(board, 3, result)));
    assert.deepEqual(board, before);
  }
});
test('cross neighbours respect edges and two presses restore every affected light', () => {
  assert.deepEqual(affectedCells(3, 0), [0, 3, 1]);
  assert.deepEqual(affectedCells(3, 4), [4, 1, 7, 3, 5]);
  const board = Array(9).fill(0);
  assert.deepEqual(toggleBoard(toggleBoard(board, 3, 0), 3, 0), board); assert.deepEqual(board, Array(9).fill(0));
  assert.equal(toggleBoard(board, 3, 9), null); assert.deepEqual(affectedCells(3, -1), []);
});
test('unreachable boards and malformed input are rejected rather than producing a false hint', () => {
  const unsolvable = Array(16).fill(0); unsolvable[0] = 1;
  assert.equal(chase(unsolvable, 4), null); assert.equal(solveLights(unsolvable, 4), null);
  assert.equal(solveLights(Array(16).fill(-1), 4), null); assert.equal(solveLights([0], 3), null); assert.equal(solveLights(Array(36).fill(0), 6), null);
  assert.deepEqual(solveLights(Array(25).fill(0), 5), []);
});
test('immutable presses, exact Undo and completion derived from the board survive save and restore', () => {
  const puzzle = PUZZLES[0], initial = createGame(puzzle), solution = solveLights(initial.board, puzzle.size);
  let game = initial;
  for (const index of solution) game = press(game, puzzle, index).state;
  assert.equal(game.completed, true); assert.equal(game.moves, solution.length); assert.deepEqual(initial.board, puzzle.board);
  game.elapsed = 47; game.hints = 2;
  const saved = serializeGame(game); assert.equal(saved.history.length, 1);
  const restored = createGame(puzzle, saved); assert.equal(restored.completed, true); assert.deepEqual(restored.board, game.board);
  const back = undo(restored, puzzle); assert.equal(back.changed, true); assert.equal(back.state.completed, false); assert.equal(back.state.moves, solution.length - 1); assert.equal(back.state.elapsed, 47);
  assert.deepEqual(press(game, puzzle, 0), {state:game, changed:false});
  saved.board[0] = 1; assert.equal(game.board[0], 0);
});
test('restore ignores false completion flags, foreign IDs, malformed and unsolvable history', () => {
  const puzzle = PUZZLES.find(p => p.size === 4), game = createGame(puzzle), saved = serializeGame(game);
  assert.equal(createGame(puzzle, {...saved, completed:true}).completed, false);
  assert.deepEqual(createGame(puzzle, {...saved, puzzleId:'other', moves:10}).board, puzzle.board);
  assert.equal(createGame(puzzle, {...saved, board:[1], moves:10}).moves, 0);
  const unreachable = Array(16).fill(0); unreachable[0] = 1;
  const restored = createGame(puzzle, {...saved, history:[{board:unreachable,moves:1,hints:0},{board:[1],moves:2,hints:0},{board:puzzle.board,moves:0,hints:0}]});
  assert.equal(restored.history.length, 1); assert.deepEqual(undo(restored, puzzle).state.board, puzzle.board);
});
test('long play keeps at most 30 history entries and in-progress serialization retains them', () => {
  const puzzle = PUZZLES[0]; let game = createGame(puzzle);
  for (let i = 0; i < 90; i++) game = press(game, puzzle, 0).state;
  assert.equal(game.history.length, 30); assert.equal(serializeGame(game).history.length, 30);
});
