const ALL = 0x3fe;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const ROWS = Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => row * 9 + col));
export const COLS = Array.from({ length: 9 }, (_, col) => Array.from({ length: 9 }, (_, row) => row * 9 + col));
export const BOXES = Array.from({ length: 9 }, (_, box) => Array.from({ length: 9 }, (_, cell) => Math.floor(box / 3) * 27 + (box % 3) * 3 + Math.floor(cell / 3) * 9 + cell % 3));
const UNITS = [...ROWS, ...COLS, ...BOXES];
const boxOf = (i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);
const PEERS = Array.from({ length: 81 }, (_, i) => [...new Set([...ROWS[Math.floor(i / 9)], ...COLS[i % 9], ...BOXES[boxOf(i)]])].filter((j) => j !== i));
const bitCount = (n) => { let count = 0; for (; n; n &= n - 1) count++; return count; };
const values = (mask) => DIGITS.filter((value) => mask & (1 << value));

function normalize(input) {
  if (!input || input.length !== 81) return null;
  const board = Array.from(input, Number);
  return board.every((value) => Number.isInteger(value) && value >= 0 && value <= 9) ? board : null;
}

function setup(input) {
  const board = normalize(input);
  if (!board) return null;
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const value = board[i];
    if (!value) continue;
    const bit = 1 << value, row = Math.floor(i / 9), col = i % 9, box = boxOf(i);
    if ((rows[row] | cols[col] | boxes[box]) & bit) return null;
    rows[row] |= bit; cols[col] |= bit; boxes[box] |= bit;
  }
  return { board, rows, cols, boxes };
}

/** Legal digits for one blank cell; filled cells and malformed boards return []. */
export function candidates(input, index) {
  const state = setup(input);
  if (!state || !Number.isInteger(index) || index < 0 || index > 80 || state.board[index]) return [];
  return values(ALL & ~(state.rows[Math.floor(index / 9)] | state.cols[index % 9] | state.boxes[boxOf(index)]));
}

function search(input, limit, random = null) {
  const state = setup(input);
  if (!state) return { count: 0, solution: null, nodes: 0, branches: 0, depth: 0 };
  const { board, rows, cols, boxes } = state;
  let count = 0, solution = null, nodes = 0, branches = 0, depth = 0;
  function visit(branchDepth) {
    nodes++;
    let selected = -1, selectedMask = 0, minimum = 10;
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const mask = ALL & ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]);
      const size = bitCount(mask);
      if (!size) return;
      if (size < minimum) { selected = i; selectedMask = mask; minimum = size; if (size === 1) break; }
    }
    if (selected === -1) { count++; solution ||= [...board]; return; }
    const row = Math.floor(selected / 9), col = selected % 9, box = boxOf(selected);
    let options = values(selectedMask);
    if (random) for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
    const nextDepth = branchDepth + (minimum > 1 ? 1 : 0);
    if (minimum > 1) branches++;
    depth = Math.max(depth, nextDepth);
    for (const value of options) {
      const bit = 1 << value;
      board[selected] = value; rows[row] |= bit; cols[col] |= bit; boxes[box] |= bit;
      visit(nextDepth);
      board[selected] = 0; rows[row] &= ~bit; cols[col] &= ~bit; boxes[box] &= ~bit;
      if (count >= limit) return;
    }
  }
  visit(0);
  return { count, solution, nodes, branches, depth };
}

export function countSolutions(input, limit = 2) { return search(input, Math.max(1, Math.trunc(limit) || 2)).count; }
export function solve(input) { return search(input, 1).solution; }
export function generateSolution(random = Math.random) { return search(Array(81).fill(0), 1, random).solution; }

/**
 * App-local rating, not a universal Sudoku standard. Levels 1–4 use singles;
 * 5–6 need locked candidates/pairs; 7–10 need increasingly costly MRV search
 * after those techniques. Clue count does not determine the level.
 */
export function ratePuzzle(input) {
  const state = setup(input);
  if (!state) return { level: 0, valid: false };
  const board = [...state.board];
  const masks = board.map((value, i) => value ? 0 : ALL & ~(state.rows[Math.floor(i / 9)] | state.cols[i % 9] | state.boxes[boxOf(i)]));
  let nakedSingles = 0, hiddenSingles = 0, lockedCandidates = 0, nakedPairs = 0;
  const place = (i, value) => {
    board[i] = value; masks[i] = 0;
    const bit = 1 << value;
    for (const peer of PEERS[i]) masks[peer] &= ~bit;
  };
  while (true) {
    let changed = false;
    for (let i = 0; i < 81; i++) {
      if (!board[i] && bitCount(masks[i]) === 1) { place(i, values(masks[i])[0]); nakedSingles++; changed = true; break; }
    }
    if (changed) continue;
    for (const unit of UNITS) {
      for (const value of DIGITS) {
        const matches = unit.filter((i) => !board[i] && (masks[i] & (1 << value)));
        if (matches.length === 1) { place(matches[0], value); hiddenSingles++; changed = true; break; }
      }
      if (changed) break;
    }
    if (changed) continue;
    // Pointing and claiming: candidates contained in the intersection of two units.
    for (const unit of UNITS) {
      for (const value of DIGITS) {
        const bit = 1 << value, matches = unit.filter((i) => !board[i] && (masks[i] & bit));
        if (matches.length < 2) continue;
        const commonUnits = UNITS.filter((other) => other !== unit && matches.every((i) => other.includes(i)));
        for (const other of commonUnits) {
          const targets = other.filter((i) => !unit.includes(i) && (masks[i] & bit));
          if (targets.length) { targets.forEach((i) => { masks[i] &= ~bit; }); lockedCandidates++; changed = true; break; }
        }
        if (changed) break;
      }
      if (changed) break;
    }
    if (changed) continue;
    for (const unit of UNITS) {
      const pairs = unit.filter((i) => !board[i] && bitCount(masks[i]) === 2);
      for (const first of pairs) {
        const twins = pairs.filter((i) => masks[i] === masks[first]);
        if (twins.length !== 2) continue;
        const mask = masks[first];
        const targets = unit.filter((i) => !twins.includes(i) && !board[i] && (masks[i] & mask));
        if (targets.length) { targets.forEach((i) => { masks[i] &= ~mask; }); nakedPairs++; changed = true; break; }
      }
      if (changed) break;
    }
    if (!changed) break;
  }
  const remaining = board.filter((v) => !v).length;
  const exploration = remaining ? search(board, 1) : { count: 1, nodes: 0, branches: 0, depth: 0 };
  let level;
  if (!exploration.count) level = 0;
  else if (remaining) level = exploration.branches <= 3 ? 7 : exploration.branches <= 12 ? 8 : exploration.branches <= 40 ? 9 : 10;
  else if (nakedPairs || lockedCandidates >= 4) level = 6;
  else if (lockedCandidates) level = 5;
  else level = hiddenSingles >= 12 ? 4 : hiddenSingles >= 5 ? 3 : hiddenSingles ? 2 : 1;
  return {
    level, valid: Boolean(exploration.count), givens: state.board.filter(Boolean).length,
    nakedSingles, hiddenSingles, lockedCandidates, nakedPairs,
    remainingAfterLogic: remaining, searchBranches: exploration.branches,
    searchNodes: exploration.nodes, searchDepth: exploration.depth,
    technique: remaining ? 'search' : nakedPairs ? 'naked-pairs' : lockedCandidates ? 'locked-candidates' : 'singles',
  };
}
