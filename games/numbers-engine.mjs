const DIRECTIONS = ['up', 'down', 'left', 'right'];
const MAX_HISTORY = 60;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const randomIndex = (length, random) => Math.min(length - 1, Math.max(0, Math.floor(random() * length)));

export function is2048Board(board) {
  return Array.isArray(board) && board.length === 16 && board.every(n => Number.isInteger(n) && (n === 0 || (n >= 2 && n <= 2 ** 30 && Number.isInteger(Math.log2(n)))));
}

export function canMove2048(board) {
  if (!is2048Board(board)) return false;
  return board.some((n, i) => !n || (i % 4 < 3 && n === board[i + 1]) || (i < 12 && n === board[i + 4]));
}

export function spawn2048(board, random = Math.random) {
  const empty = board.map((value, index) => value === 0 ? index : -1).filter(index => index >= 0);
  if (!empty.length) return { board: board.slice(), index: -1 };
  const index = empty[randomIndex(empty.length, random)];
  const next = board.slice();
  next[index] = random() < .9 ? 2 : 4;
  return { board: next, index };
}

function snapshot2048(state) {
  return { board: state.board.slice(), score: state.score, moves: state.moves };
}

export function create2048(random = Math.random) {
  const first = spawn2048(Array(16).fill(0), random);
  const second = spawn2048(first.board, random);
  return { board: second.board, score: 0, moves: 0, won: false, over: false, spawned: second.index, merged: [], history: [] };
}

/** A tile is consumed once per move: [2,2,4,0] becomes [4,4,0,0]. */
export function slide2048(board, direction) {
  if (!is2048Board(board) || !DIRECTIONS.includes(direction)) return { board: board?.slice?.() || [], score: 0, changed: false, merged: [] };
  const next = board.slice(), merged = [];
  let score = 0;
  for (let line = 0; line < 4; line++) {
    let positions = Array.from({ length: 4 }, (_, i) => direction === 'left' || direction === 'right' ? line * 4 + i : i * 4 + line);
    if (direction === 'right' || direction === 'down') positions.reverse();
    const values = positions.map(index => board[index]).filter(Boolean);
    const output = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        const value = values[i] * 2;
        output.push(value); score += value; merged.push(positions[output.length - 1]); i++;
      } else output.push(values[i]);
    }
    positions.forEach((index, i) => { next[index] = output[i] || 0; });
  }
  return { board: next, score, changed: next.some((n, i) => n !== board[i]), merged };
}

export function move2048(state, direction, random = Math.random) {
  const slid = slide2048(state.board, direction);
  if (!slid.changed) return { state, changed: false };
  const spawned = spawn2048(slid.board, random);
  const next = {
    board: spawned.board,
    score: state.score + slid.score,
    moves: state.moves + 1,
    won: spawned.board.some(n => n >= 2048),
    over: !canMove2048(spawned.board),
    spawned: spawned.index,
    merged: slid.merged,
    history: [...state.history.slice(-(MAX_HISTORY - 1)), snapshot2048(state)],
  };
  return { state: next, changed: true, gained: slid.score };
}

export function undo2048(state) {
  if (!state.history.length) return { state, changed: false };
  const previous = state.history.at(-1);
  return { state: { ...previous, board: previous.board.slice(), history: state.history.slice(0, -1), won: previous.board.some(n => n >= 2048), over: !canMove2048(previous.board), spawned: -1, merged: [] }, changed: true };
}

export const solvedFifteen = () => Array.from({ length: 16 }, (_, i) => (i + 1) % 16);
export const isFifteenBoard = board => Array.isArray(board) && board.length === 16 && new Set(board).size === 16 && board.every(n => Number.isInteger(n) && n >= 0 && n < 16);
export const isFifteenSolved = board => isFifteenBoard(board) && board.every((n, i) => n === (i + 1) % 16);
export function isFifteenSolvable(board) {
  if (!isFifteenBoard(board)) return false;
  let inversions = 0;
  board.forEach((n, i) => { if (n) for (let j = i + 1; j < 16; j++) if (board[j] && n > board[j]) inversions++; });
  return (inversions + 4 - Math.floor(board.indexOf(0) / 4)) % 2 === 1;
}

export function fifteenNeighbors(blank) {
  return [blank % 4 > 0 ? blank - 1 : -1, blank % 4 < 3 ? blank + 1 : -1, blank >= 4 ? blank - 4 : -1, blank < 12 ? blank + 4 : -1].filter(n => n >= 0);
}

/** Shuffle by legal moves so every deal is reachable from the goal. */
export function createFifteen(random = Math.random) {
  const board = solvedFifteen();
  let blank = 15, previous = -1;
  for (let i = 0; i < 220; i++) {
    const options = fifteenNeighbors(blank).filter(index => index !== previous);
    const index = options[randomIndex(options.length, random)];
    [board[blank], board[index]] = [board[index], board[blank]];
    previous = blank; blank = index;
  }
  if (isFifteenSolved(board)) {
    const index = fifteenNeighbors(blank)[0];
    [board[blank], board[index]] = [board[index], board[blank]];
  }
  return { board, moves: 0, elapsed: 0, completed: false, history: [], moved: -1 };
}

export function moveFifteen(state, index) {
  const blank = state.board.indexOf(0);
  if (state.completed || !Number.isInteger(index) || !fifteenNeighbors(blank).includes(index)) return { state, changed: false };
  const board = state.board.slice();
  [board[blank], board[index]] = [board[index], board[blank]];
  return { state: { ...state, board, moves: state.moves + 1, completed: isFifteenSolved(board), moved: blank, history: [...state.history.slice(-(MAX_HISTORY - 1)), { board: state.board.slice(), moves: state.moves }] }, changed: true };
}

export function moveFifteenBlank(state, direction) {
  const blank = state.board.indexOf(0);
  const delta = { up: -4, down: 4, left: -1, right: 1 }[direction];
  if (!DIRECTIONS.includes(direction)) return { state, changed: false };
  const target = blank + delta;
  if ((direction === 'left' && blank % 4 === 0) || (direction === 'right' && blank % 4 === 3)) return { state, changed: false };
  return moveFifteen(state, target);
}

export function undoFifteen(state) {
  if (!state.history.length) return { state, changed: false };
  const previous = state.history.at(-1);
  return { state: { ...state, board: previous.board.slice(), moves: previous.moves, completed: isFifteenSolved(previous.board), moved: -1, history: state.history.slice(0, -1) }, changed: true };
}

export function restoreNumberGame(id, saved, random = Math.random) {
  if (id === '2048') {
    if (!saved || !is2048Board(saved.board) || !saved.board.some(Boolean)) return create2048(random);
    const history = Array.isArray(saved.history) ? saved.history.slice(-MAX_HISTORY).filter(item => item && is2048Board(item.board) && item.board.some(Boolean)).map(item => ({ board: item.board.slice(), score: count(item.score), moves: count(item.moves) })) : [];
    return { board: saved.board.slice(), score: count(saved.score), moves: count(saved.moves), won: saved.board.some(n => n >= 2048), over: !canMove2048(saved.board), spawned: -1, merged: [], history };
  }
  if (!saved || !isFifteenSolvable(saved.board)) return createFifteen(random);
  const history = Array.isArray(saved.history) ? saved.history.slice(-MAX_HISTORY).filter(item => item && isFifteenSolvable(item.board)).map(item => ({ board: item.board.slice(), moves: count(item.moves) })) : [];
  return { board: saved.board.slice(), moves: count(saved.moves), elapsed: count(saved.elapsed), completed: isFifteenSolved(saved.board), history, moved: -1 };
}
