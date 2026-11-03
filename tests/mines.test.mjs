import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, createMines, neighbors, reveal, toggleFlag, chord, restartMines, restoreMines } from '../games/mines-engine.mjs';

let seed = 629;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

test('every preset keeps the opening and its entire neighborhood safe', () => {
  for (const key of Object.keys(PRESETS)) for (const index of [0, 40, PRESETS[key].rows * PRESETS[key].cols - 1]) {
    const base = createMines(key), game = reveal(base, index, random);
    assert.equal(base.status, 'ready'); assert.equal(base.mines.some(Boolean), false);
    assert.equal(game.mines.filter(Boolean).length, base.mineCount);
    for (const i of [index, ...neighbors(index, base.rows, base.cols)]) assert.equal(game.mines[i], false);
    game.adjacent.forEach((count, i) => assert.equal(count, neighbors(i, game.rows, game.cols).filter(j => game.mines[j]).length));
    assert.equal(game.open[index], true); assert.equal(game.adjacent[index], 0);
  }
});

test('flood fill reveals safe zeros and their numbered boundary, preserving flags', () => {
  let base = createMines(); base = toggleFlag(base, 0);
  assert.equal(reveal(base, 0, random), base);
  const game = reveal(base, 40, random);
  assert.equal(game.open[0], false); assert.equal(game.flags[0], true);
  assert.ok(game.open.filter(Boolean).length > 1);
  assert.equal(game.open.some((v, i) => v && game.mines[i]), false);
  game.open.forEach((open, i) => {
    if (open && game.adjacent[i] === 0) for (const j of neighbors(i, game.rows, game.cols)) assert.ok(game.open[j] || game.flags[j]);
  });
});

test('flags are immutable, capped, cannot flag open cells, and do not win the game', () => {
  const base = createMines(); let game = base;
  for (let i = 0; i < 10; i++) game = toggleFlag(game, i);
  assert.equal(base.flags.some(Boolean), false); assert.equal(game.status, 'ready');
  assert.equal(toggleFlag(game, 10), game);
  game = toggleFlag(game, 0); assert.equal(game.flags[0], false);
  game = reveal(game, 40, random);
  assert.equal(toggleFlag(game, 40), game);
});

test('chording requires matching flags; correct flags safely reveal the remaining neighbors', () => {
  let game = reveal(createMines(), 40, random);
  const target = game.open.findIndex((v, i) => v && game.adjacent[i] && neighbors(i, game.rows, game.cols).some(j => !game.open[j] && !game.mines[j]));
  assert.ok(target >= 0); assert.equal(chord(game, target), game);
  for (const i of neighbors(target, game.rows, game.cols).filter(j => game.mines[j])) game = toggleFlag(game, i);
  const previous = game; game = chord(game, target);
  assert.notEqual(game, previous); assert.notEqual(game.status, 'lost');
  for (const i of neighbors(target, game.rows, game.cols)) assert.ok(game.open[i] || game.flags[i]);
});

test('an incorrectly placed matching flag can make a chord hit a mine', () => {
  let game = reveal(createMines(), 40, random);
  const target = game.open.findIndex((v, i) => v && game.adjacent[i] === 1 && neighbors(i, game.rows, game.cols).some(j => !game.open[j] && !game.mines[j]));
  assert.ok(target >= 0);
  const wrong = neighbors(target, game.rows, game.cols).find(j => !game.open[j] && !game.mines[j]);
  game = toggleFlag(game, wrong); game = chord(game, target); assert.equal(game.status, 'lost');
});

test('loss is terminal and exact-board replay resets flags and time with a safe opening', () => {
  let game = reveal(createMines('medium'), 40, random); game.elapsed = 42;
  const hit = game.mines.findIndex(Boolean); game = reveal(game, hit);
  assert.equal(game.status, 'lost'); assert.equal(game.detonated, hit); assert.equal(reveal(game, 0), game); assert.equal(toggleFlag(game, 1), game);
  const retry = restartMines(game);
  assert.deepEqual(retry.mines, game.mines); assert.equal(retry.elapsed, 0); assert.equal(retry.status, 'playing'); assert.equal(retry.detonated, null); assert.equal(retry.flags.some(Boolean), false);
  assert.equal(retry.open[40], true); assert.equal(retry.open.some((v, i) => v && retry.mines[i]), false);
});

test('only opening every safe cell wins; ended game cannot be changed', () => {
  let game = reveal(createMines(), 40, random);
  for (let i = 0; i < game.mines.length; i++) if (!game.mines[i]) game = reveal(game, i);
  assert.equal(game.status, 'won'); assert.equal(game.open.filter(Boolean).length, 71);
  assert.equal(reveal(game, 0), game); assert.equal(toggleFlag(game, 0), game);
});

test('saved state round trips but corrupt shapes, fake completion and unsafe openings are rejected', () => {
  const ready = createMines(); assert.deepEqual(restoreMines(ready), ready);
  let game = reveal(ready, 40, random); game.elapsed = 91;
  const restored = restoreMines(JSON.parse(JSON.stringify(game))); assert.deepEqual(restored, game);
  restored.open[0] = !restored.open[0]; assert.notEqual(restored.open[0], game.open[0]);
  assert.equal(restoreMines({ ...game, status: 'won' }), null);
  assert.equal(restoreMines({ ...game, rows: 8 }), null);
  assert.equal(restoreMines({ ...game, mines: game.mines.slice(1) }), null);
  assert.equal(restoreMines({ ...game, elapsed: -1 }), null);
  assert.equal(restoreMines({ ...game, firstIndex: game.mines.findIndex(Boolean) }), null);
  assert.equal(restoreMines({ ...ready, status: 'playing' }), null);
  assert.equal(restoreMines({ ...ready, firstIndex: undefined }), null);
  const wrongAdjacency = { ...game, adjacent: Array(81).fill(8) }; assert.deepEqual(restoreMines(wrongAdjacency).adjacent, game.adjacent);
});
