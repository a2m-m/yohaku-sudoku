import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, serializeGame, enterNumber, eraseCell, undo, fillNotes, giveHint, isComplete } from '../src/game.mjs';

const solution = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const puzzle = { id: 1, givens: '000678912672195348198342567859761423426853791713924856961537284287419635345286179', solution };

test('fixed clues and invalid input cannot alter game state', () => {
  const game = createGame(puzzle);
  for (const index of [-1, 81, 2.5, 3]) {
    assert.equal(enterNumber(game, puzzle, index, 1).game, game);
    assert.equal(eraseCell(game, puzzle, index).game, game);
  }
  for (const digit of [0, 10, -1, 1.5, '1']) assert.equal(enterNumber(game, puzzle, 0, digit).game, game);
  assert.equal(undo(game).changed, false);
});

test('notes toggle without filling cells and preserve immutable previous state', () => {
  const original = createGame(puzzle);
  const result = enterNumber(original, puzzle, 0, 5, { noteMode: true });
  assert.equal(result.game.notes[0], 16);
  assert.equal(result.game.board[0], 0);
  assert.equal(original.notes[0], 0);
  assert.equal(enterNumber(result.game, puzzle, 0, 5, { noteMode: true }).game.notes[0], 0);
  assert.deepEqual(undo(result.game).game.board, original.board);
  assert.deepEqual(undo(result.game).game.notes, original.notes);
});

test('normal entry clears own and peer notes and undo restores all of them', () => {
  let game = createGame(puzzle);
  game = enterNumber(game, puzzle, 0, 5, { noteMode: true }).game;
  game = enterNumber(game, puzzle, 1, 5, { noteMode: true }).game;
  const before = serializeGame(game);
  const next = enterNumber(game, puzzle, 0, 5).game;
  assert.equal(next.board[0], 5);
  assert.equal(next.notes[0], 0);
  assert.equal(next.notes[1], 0);
  assert.deepEqual(serializeGame(undo(next).game), before);
});

test('wrong answers remain editable; auto-check counts an entry once', () => {
  const original = createGame(puzzle);
  const wrong = enterNumber(original, puzzle, 0, 1, { autoCheck: true });
  assert.equal(wrong.wrong, true);
  assert.equal(wrong.game.board[0], 1);
  assert.equal(wrong.game.mistakes, 1);
  assert.equal(enterNumber(wrong.game, puzzle, 0, 1, { autoCheck: true }).changed, false);
  assert.equal(enterNumber(original, puzzle, 0, 1).game.mistakes, 0);
  assert.equal(eraseCell(wrong.game, puzzle, 0).game.board[0], 0);
  assert.equal(undo(wrong.game).game.mistakes, 0);
});

test('fill notes computes legal candidates and can be undone', () => {
  const original = createGame(puzzle);
  const result = fillNotes(original, puzzle);
  assert.equal(result.game.notes[0], 16);
  assert.equal(result.game.notes[1], 4);
  assert.equal(result.game.notes[2], 8);
  assert.equal(result.game.notes[3], 0);
  assert.equal(fillNotes(result.game, puzzle).changed, false);
  assert.deepEqual(undo(result.game).game.notes, original.notes);
});

test('unlimited hints repair selected mistakes and completion requires exact solution', () => {
  let game = enterNumber(createGame(puzzle), puzzle, 1, 9).game;
  const repair = giveHint(game, puzzle, 1);
  assert.equal(repair.index, 1);
  assert.equal(repair.digit, 3);
  game = repair.game;
  game = giveHint(game, puzzle, 3).game;
  assert.equal(game.board[0], 5);
  const final = giveHint(game, puzzle);
  assert.equal(final.game.hints, 3);
  assert.equal(final.completed, true);
  assert.equal(isComplete(final.game, puzzle), true);
  assert.equal(giveHint(final.game, puzzle).changed, false);
  assert.equal(enterNumber(final.game, puzzle, 0, 1).changed, false);
  assert.equal(undo(final.game).game.completed, false);
});

test('serializing round-trips progress and undo history without sharing arrays', () => {
  let game = enterNumber(createGame(puzzle), puzzle, 0, 5).game;
  game = enterNumber(game, puzzle, 1, 3, { noteMode: true }).game;
  game.elapsed = 81;
  const saved = serializeGame(game);
  const restored = createGame(puzzle, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(serializeGame(restored), saved);
  assert.equal(restored.elapsed, 81);
  restored.board[0] = 1;
  assert.equal(saved.board[0], 5);
  assert.equal(game.board[0], 5);
  assert.equal(undo(createGame(puzzle, saved)).game.notes[1], 0);
});

test('corrupt saved data cannot overwrite clues, fake completion, or another puzzle', () => {
  const game = createGame(puzzle);
  const corrupt = {
    puzzleId: 1,
    board: Array(81).fill(100),
    notes: Array(81).fill(0xffff),
    completed: true,
    elapsed: -20,
    mistakes: -1,
    hints: '20',
    history: [{ board: [] }, null],
  };
  const restored = createGame(puzzle, corrupt);
  assert.equal(restored.board[0], 0);
  assert.equal(restored.board[3], 6);
  assert.equal(restored.notes[0], 511);
  assert.equal(restored.notes[3], 0);
  assert.equal(restored.completed, false);
  assert.equal(restored.elapsed, 0);
  assert.equal(restored.mistakes, 0);
  assert.equal(restored.hints, 0);
  assert.equal(restored.history.length, 0);
  assert.deepEqual(createGame(puzzle, { ...corrupt, puzzleId: 2 }), game);
});

test('history is bounded and elapsed time does not rewind', () => {
  let game = createGame(puzzle);
  for (let index = 0; index < 320; index++) game = enterNumber(game, puzzle, 0, index % 2 ? 1 : 2).game;
  assert.equal(game.history.length, 300);
  game.elapsed = 500;
  assert.equal(undo(game).game.elapsed, 500);
});
