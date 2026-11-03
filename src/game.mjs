import { candidates } from './sudoku.mjs';

const SIZE = 81;
const MAX_HISTORY = 300;
const ALL_NOTES = 0x1ff;

function puzzleValues(puzzle) {
  if (!puzzle || !/^[0-9]{81}$/.test(puzzle.givens) || !/^[1-9]{81}$/.test(puzzle.solution)) {
    throw new TypeError('A puzzle requires 81 givens and solution digits.');
  }
  return {
    givens: Array.from(puzzle.givens, Number),
    solution: Array.from(puzzle.solution, Number),
  };
}

const counter = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const validIndex = index => Number.isInteger(index) && index >= 0 && index < SIZE;
const validDigit = digit => Number.isInteger(digit) && digit >= 1 && digit <= 9;

function normalizeSnapshot(saved, givens, solution) {
  if (!saved || !Array.isArray(saved.board) || saved.board.length !== SIZE) return null;
  const board = saved.board.map((value, index) => givens[index] || (Number.isInteger(value) && value >= 0 && value <= 9 ? value : 0));
  const notes = Array.from({ length: SIZE }, (_, index) => {
    if (board[index]) return 0;
    const value = saved.notes?.[index];
    return Number.isInteger(value) && value >= 0 ? value & ALL_NOTES : 0;
  });
  return {
    board,
    notes,
    mistakes: counter(saved.mistakes),
    hints: counter(saved.hints),
    completed: board.every((value, index) => value === solution[index]),
  };
}

/** Restore only validated state belonging to this puzzle. Storage stays outside this module. */
export function createGame(puzzle, saved = null) {
  const { givens, solution } = puzzleValues(puzzle);
  const belongsToPuzzle = saved && saved.puzzleId === puzzle.id;
  const restored = belongsToPuzzle ? normalizeSnapshot(saved, givens, solution) : null;
  const base = restored || {
    board: givens.slice(),
    notes: Array(SIZE).fill(0),
    mistakes: 0,
    hints: 0,
    completed: givens.every((value, index) => value === solution[index]),
  };
  const history = restored && Array.isArray(saved.history)
    ? saved.history.slice(-MAX_HISTORY).map(item => normalizeSnapshot(item, givens, solution)).filter(Boolean)
    : [];
  return {
    puzzleId: puzzle.id,
    ...base,
    history,
    elapsed: restored ? counter(saved.elapsed) : 0,
  };
}

/** JSON-compatible plain object; callers may JSON.stringify together with other app preferences. */
export function serializeGame(game) {
  return {
    version: 1,
    puzzleId: game.puzzleId,
    ...snapshot(game),
    elapsed: counter(game.elapsed),
    history: game.history.slice(-MAX_HISTORY).map(snapshot),
  };
}

function snapshot(game) {
  return {
    board: game.board.slice(),
    notes: game.notes.slice(),
    mistakes: game.mistakes,
    hints: game.hints,
    completed: game.completed,
  };
}

const unchanged = game => ({ game, changed: false, wrong: false, completed: game.completed });

function apply(game, puzzle, patch, extra = {}) {
  const next = {
    ...game,
    ...patch,
    history: [...game.history.slice(-(MAX_HISTORY - 1)), snapshot(game)],
  };
  next.completed = isComplete(next, puzzle);
  return { game: next, changed: true, wrong: false, completed: next.completed, ...extra };
}

function editable(game, puzzle, index) {
  return !game.completed && validIndex(index) && puzzle.givens[index] === '0';
}

function isPeer(a, b) {
  const rowA = Math.floor(a / 9);
  const rowB = Math.floor(b / 9);
  const colA = a % 9;
  const colB = b % 9;
  return rowA === rowB || colA === colB || (Math.floor(rowA / 3) === Math.floor(rowB / 3) && Math.floor(colA / 3) === Math.floor(colB / 3));
}

function notesAfterEntry(game, index, digit) {
  const bit = 1 << (digit - 1);
  return game.notes.map((value, position) => position === index ? 0 : isPeer(index, position) ? value & ~bit : value);
}

export function isComplete(game, puzzle) {
  return game.board.length === SIZE && game.board.every((value, index) => value === Number(puzzle.solution[index]));
}

/** Wrong values remain on the board. autoCheck controls whether they count as mistakes. */
export function enterNumber(game, puzzle, index, digit, { noteMode = false, autoCheck = false } = {}) {
  if (!editable(game, puzzle, index) || !validDigit(digit)) return unchanged(game);
  if (noteMode) {
    if (game.board[index] !== 0) return unchanged(game);
    const notes = game.notes.slice();
    notes[index] ^= 1 << (digit - 1);
    return apply(game, puzzle, { notes });
  }
  if (game.board[index] === digit) return unchanged(game);
  const board = game.board.slice();
  board[index] = digit;
  const wrong = digit !== Number(puzzle.solution[index]);
  return apply(game, puzzle, {
    board,
    notes: notesAfterEntry(game, index, digit),
    mistakes: game.mistakes + (autoCheck && wrong ? 1 : 0),
  }, { wrong });
}

export function eraseCell(game, puzzle, index) {
  if (!editable(game, puzzle, index) || (!game.board[index] && !game.notes[index])) return unchanged(game);
  const board = game.board.slice();
  const notes = game.notes.slice();
  board[index] = 0;
  notes[index] = 0;
  return apply(game, puzzle, { board, notes });
}

export function undo(game) {
  if (!game.history.length) return unchanged(game);
  const previous = game.history.at(-1);
  const next = {
    ...game,
    ...snapshot(previous),
    history: game.history.slice(0, -1),
  };
  return { game: next, changed: true, wrong: false, completed: next.completed };
}

export function fillNotes(game, puzzle) {
  if (game.completed) return unchanged(game);
  const notes = game.board.map((value, index) => value ? 0 : candidates(game.board, index).reduce((mask, digit) => mask | (1 << (digit - 1)), 0));
  if (notes.every((value, index) => value === game.notes[index])) return unchanged(game);
  return apply(game, puzzle, { notes });
}

/** Reveal the selected unsolved cell, or the first unsolved cell when selection is absent/fixed. */
export function giveHint(game, puzzle, index = -1) {
  if (game.completed) return unchanged(game);
  let target = index;
  if (!editable(game, puzzle, target) || game.board[target] === Number(puzzle.solution[target])) {
    target = game.board.findIndex((value, position) => puzzle.givens[position] === '0' && value !== Number(puzzle.solution[position]));
  }
  if (target < 0) return unchanged(game);
  const digit = Number(puzzle.solution[target]);
  const board = game.board.slice();
  board[target] = digit;
  return apply(game, puzzle, {
    board,
    notes: notesAfterEntry(game, target, digit),
    hints: game.hints + 1,
  }, { index: target, digit });
}
