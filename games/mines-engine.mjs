export const PRESETS = Object.freeze({
  easy: { label: '初級', rows: 9, cols: 9, mineCount: 10 },
  medium: { label: '中級', rows: 12, cols: 12, mineCount: 24 },
  hard: { label: '上級', rows: 16, cols: 16, mineCount: 50 },
});

export function neighbors(index, rows, cols) {
  const r = Math.floor(index / cols), c = index % cols, result = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if ((dr || dc) && rr >= 0 && rr < rows && cc >= 0 && cc < cols) result.push(rr * cols + cc);
  }
  return result;
}

export function createMines(difficulty = 'easy') {
  if (!PRESETS[difficulty]) difficulty = 'easy';
  const { rows, cols, mineCount } = PRESETS[difficulty], length = rows * cols;
  return { version: 1, difficulty, rows, cols, mineCount, mines: Array(length).fill(false), open: Array(length).fill(false), flags: Array(length).fill(false), adjacent: Array(length).fill(0), status: 'ready', firstIndex: null, detonated: null, elapsed: 0 };
}

const validIndex = (state, index) => Number.isInteger(index) && index >= 0 && index < state.rows * state.cols;
const ended = state => state.status === 'won' || state.status === 'lost';
const clone = state => ({ ...state, mines: [...state.mines], open: [...state.open], flags: [...state.flags], adjacent: [...state.adjacent] });
const adjacentCounts = (mines, rows, cols) => mines.map((_, index) => neighbors(index, rows, cols).filter(i => mines[i]).length);

function plant(state, firstIndex, random) {
  const next = clone(state), excluded = new Set([firstIndex, ...neighbors(firstIndex, state.rows, state.cols)]);
  const choices = next.mines.map((_, i) => i).filter(i => !excluded.has(i));
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  choices.slice(0, state.mineCount).forEach(i => { next.mines[i] = true; });
  next.adjacent = adjacentCounts(next.mines, next.rows, next.cols);
  next.status = 'playing'; next.firstIndex = firstIndex;
  return next;
}

function flood(next, indices) {
  const stack = [...indices];
  while (stack.length) {
    const i = stack.pop();
    if (next.open[i] || next.flags[i]) continue;
    next.open[i] = true;
    if (next.mines[i]) { next.detonated = i; next.status = 'lost'; return; }
    if (next.adjacent[i] === 0) stack.push(...neighbors(i, next.rows, next.cols).filter(j => !next.open[j] && !next.flags[j]));
  }
  if (next.open.filter((isOpen, i) => isOpen && !next.mines[i]).length === next.rows * next.cols - next.mineCount) next.status = 'won';
}

export function reveal(state, index, random = Math.random) {
  if (!validIndex(state, index) || ended(state) || state.flags[index]) return state;
  if (state.open[index]) return chord(state, index);
  const next = state.status === 'ready' ? plant(state, index, random) : clone(state);
  flood(next, [index]);
  return next;
}

export function toggleFlag(state, index) {
  if (!validIndex(state, index) || ended(state) || state.open[index]) return state;
  if (!state.flags[index] && state.flags.filter(Boolean).length >= state.mineCount) return state;
  const next = clone(state); next.flags[index] = !next.flags[index]; return next;
}

/** A numbered cell opens remaining neighbors only when its flag count matches. Wrong flags can lose. */
export function chord(state, index) {
  if (!validIndex(state, index) || state.status !== 'playing' || !state.open[index] || !state.adjacent[index]) return state;
  const near = neighbors(index, state.rows, state.cols);
  if (near.filter(i => state.flags[i]).length !== state.adjacent[index]) return state;
  const targets = near.filter(i => !state.flags[i] && !state.open[i]);
  if (!targets.length) return state;
  const next = clone(state); flood(next, targets); return next;
}

/** Replay the exact same board from its safe original opening. */
export function restartMines(state) {
  if (state.firstIndex === null) return createMines(state.difficulty);
  const next = clone(state);
  next.open.fill(false); next.flags.fill(false); next.elapsed = 0; next.detonated = null; next.status = 'playing';
  flood(next, [next.firstIndex]); return next;
}

/** Validate persisted boards before trusting any mine positions or completion flag. */
export function restoreMines(saved) {
  if (!saved || saved.version !== 1 || !PRESETS[saved.difficulty]) return null;
  const base = createMines(saved.difficulty), length = base.rows * base.cols;
  if (saved.rows !== base.rows || saved.cols !== base.cols || saved.mineCount !== base.mineCount) return null;
  for (const key of ['mines', 'open', 'flags']) if (!Array.isArray(saved[key]) || saved[key].length !== length || !saved[key].every(value => typeof value === 'boolean')) return null;
  if (saved.open.some((v, i) => v && saved.flags[i]) || saved.flags.filter(Boolean).length > base.mineCount) return null;
  if (!Number.isSafeInteger(saved.elapsed) || saved.elapsed < 0 || saved.elapsed > 31536000) return null;
  const initialized = saved.firstIndex !== null;
  if (initialized) {
    if (!validIndex(base, saved.firstIndex) || saved.mines.filter(Boolean).length !== base.mineCount) return null;
    if ([saved.firstIndex, ...neighbors(saved.firstIndex, base.rows, base.cols)].some(i => saved.mines[i])) return null;
    if (!saved.open[saved.firstIndex]) return null;
  } else if (saved.mines.some(Boolean) || saved.open.some(Boolean) || saved.elapsed !== 0) return null;
  const hit = saved.open.findIndex((v, i) => v && saved.mines[i]);
  const safeOpen = saved.open.filter((v, i) => v && !saved.mines[i]).length;
  const status = !initialized ? 'ready' : hit >= 0 ? 'lost' : safeOpen === length - base.mineCount ? 'won' : 'playing';
  if (saved.status !== status) return null;
  return { ...base, mines: [...saved.mines], open: [...saved.open], flags: [...saved.flags], adjacent: adjacentCounts(saved.mines, base.rows, base.cols), firstIndex: saved.firstIndex, detonated: hit >= 0 ? hit : null, elapsed: saved.elapsed, status };
}
