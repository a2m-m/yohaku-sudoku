// Cross-shaped Lights Out. All operations are independent of the DOM.
export const SIZES = [3, 4, 5];
const integer = value => Number.isSafeInteger(value) && value >= 0;
const validBoard = (board, size) => SIZES.includes(size) && Array.isArray(board) && board.length === size * size && board.every(value => value === 0 || value === 1);

export function affectedCells(size, index) {
  if (!SIZES.includes(size) || !Number.isInteger(index) || index < 0 || index >= size * size) return [];
  const row = Math.floor(index / size), col = index % size;
  return [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size).map(([r, c]) => r * size + c);
}
export function toggleBoard(board, size, index) {
  if (!validBoard(board, size) || !affectedCells(size, index).length) return null;
  const next = board.slice();
  for (const cell of affectedCells(size, index)) next[cell] ^= 1;
  return next;
}
const weight = bits => { let count = 0; for (let value = bits >>> 0; value; value &= value - 1) count++; return count; };

// Gaussian elimination over GF(2), followed by nullspace enumeration. The
// largest supported board is 5x5, so every coefficient fits in one 32-bit word.
// Enumerating the (at most four) free variables returns a minimum-press solution.
export function solveLights(board, size) {
  if (!validBoard(board, size)) return null;
  const count = size * size, rhs = 1 << count, mask = rhs - 1;
  const rows = board.map((value, cell) => {
    let equation = value ? rhs : 0;
    for (const press of affectedCells(size, cell)) equation |= 1 << press;
    return equation;
  });
  const pivots = [];
  let rank = 0;
  for (let col = 0; col < count; col++) {
    const found = rows.findIndex((row, index) => index >= rank && (row & (1 << col)));
    if (found < 0) continue;
    [rows[rank], rows[found]] = [rows[found], rows[rank]];
    for (let row = 0; row < count; row++) if (row !== rank && (rows[row] & (1 << col))) rows[row] ^= rows[rank];
    pivots.push(col); rank++;
  }
  if (rows.some(row => !(row & mask) && (row & rhs))) return null;
  let particular = 0;
  for (let row = 0; row < rank; row++) if (rows[row] & rhs) particular |= 1 << pivots[row];
  const basis = [];
  for (let col = 0; col < count; col++) if (!pivots.includes(col)) {
    let vector = 1 << col;
    for (let row = 0; row < rank; row++) if (rows[row] & (1 << col)) vector |= 1 << pivots[row];
    basis.push(vector);
  }
  let best = particular, bestWeight = weight(best);
  for (let subset = 1; subset < 2 ** basis.length; subset++) {
    let candidate = particular;
    for (let i = 0; i < basis.length; i++) if (subset & (1 << i)) candidate ^= basis[i];
    const candidateWeight = weight(candidate);
    if (candidateWeight < bestWeight || candidateWeight === bestWeight && candidate < best) { best = candidate; bestWeight = candidateWeight; }
  }
  return Array.from({length: count}, (_, index) => index).filter(index => best & (1 << index));
}
export const isComplete = board => Array.isArray(board) && board.length > 0 && board.every(value => value === 0);
const snapshot = game => ({board: game.board.slice(), moves: game.moves, hints: game.hints});

export function createGame(puzzle, saved = null) {
  const validSnapshot = value => value && validBoard(value.board, puzzle.size) && integer(value.moves) && integer(value.hints);
  const current = saved?.puzzleId === puzzle.id && validSnapshot(saved) && solveLights(saved.board, puzzle.size) !== null ? saved : null;
  const board = current ? current.board.slice() : puzzle.board.slice();
  return {
    puzzleId: puzzle.id, board, moves: current?.moves || 0, hints: current?.hints || 0,
    elapsed: current && integer(current.elapsed) ? current.elapsed : 0,
    history: current && Array.isArray(current.history) ? current.history.slice(-30).filter(value => validSnapshot(value) && solveLights(value.board, puzzle.size) !== null).map(snapshot) : [],
    completed: isComplete(board)
  };
}
export function press(game, puzzle, index) {
  if (game.completed) return {state: game, changed: false};
  const board = toggleBoard(game.board, puzzle.size, index);
  if (!board) return {state: game, changed: false};
  return {changed: true, state: {...game, board, moves: game.moves + 1, history: [...game.history.slice(-29), snapshot(game)], completed: isComplete(board)}};
}
export function undo(game, puzzle) {
  if (!game.history.length) return {state: game, changed: false};
  const previous = game.history.at(-1);
  return {changed: true, state: {...game, ...snapshot(previous), history: game.history.slice(0, -1), completed: isComplete(previous.board)}};
}
export function serializeGame(game) {
  return {version: 1, puzzleId: game.puzzleId, ...snapshot(game), elapsed: game.elapsed, completed: game.completed, history: game.history.slice(game.completed ? -1 : -30).map(snapshot)};
}
