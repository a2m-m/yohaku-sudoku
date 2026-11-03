/** Small, dependency-free engines for draw-one Klondike and FreeCell. */
export const SUITS = ['♠', '♥', '♣', '♦'];
export const rank = id => id % 13 + 1;
export const suit = id => Math.floor(id / 13);
export const isRed = id => suit(id) === 1 || suit(id) === 3;
export const label = id => `${SUITS[suit(id)]}${['','A','2','3','4','5','6','7','8','9','10','J','Q','K'][rank(id)]}`;
const card = id => Number.isInteger(id) && id >= 0 && id < 52;
const variantOK = id => id === 'solitaire' || id === 'freecell';
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
const cloneColumns = columns => columns.map(column => column.map(c => ({ ...c })));

function snapshot(state) {
  return {
    variant: state.variant, stock: [...state.stock], waste: [...state.waste],
    foundations: state.foundations.map(p => [...p]), cells: [...state.cells],
    tableau: cloneColumns(state.tableau), moves: count(state.moves), won: state.foundations.every(pile => pile.length === 13),
  };
}

export function createState(variant = 'solitaire', random = Math.random) {
  if (!variantOK(variant)) throw new TypeError('Unknown card game');
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau = Array.from({ length: variant === 'freecell' ? 8 : 7 }, () => []);
  if (variant === 'solitaire') {
    tableau.forEach((pile, index) => { for (let j = 0; j <= index; j++) pile.push({ id: deck.pop(), up: j === index }); });
  } else {
    deck.forEach((id, i) => tableau[i % 8].push({ id, up: true }));
    deck.length = 0;
  }
  const state = { version: 1, variant, stock: deck, waste: [], foundations: [[], [], [], []], cells: [null, null, null, null], tableau, moves: 0, elapsed: 0, won: false, history: [] };
  state.deal = snapshot(state);
  return state;
}

export function validateState(raw, variant = raw?.variant) {
  if (!raw || !variantOK(variant) || raw.variant !== variant || !Array.isArray(raw.stock) || !Array.isArray(raw.waste)) return false;
  if (!Array.isArray(raw.foundations) || raw.foundations.length !== 4 || !Array.isArray(raw.cells) || raw.cells.length !== 4 || !Array.isArray(raw.tableau) || raw.tableau.length !== (variant === 'freecell' ? 8 : 7)) return false;
  const all = [...raw.stock, ...raw.waste];
  if (variant === 'freecell' && (raw.stock.length || raw.waste.length)) return false;
  if (variant === 'solitaire' && raw.cells.some(value => value !== null)) return false;
  for (let s = 0; s < 4; s++) {
    const pile = raw.foundations[s];
    if (!Array.isArray(pile) || pile.length > 13 || pile.some((id, i) => !card(id) || suit(id) !== s || rank(id) !== i + 1)) return false;
    all.push(...pile);
  }
  for (const value of raw.cells) { if (value !== null) { if (!card(value)) return false; all.push(value); } }
  for (const pile of raw.tableau) {
    if (!Array.isArray(pile)) return false;
    let sawUp = false;
    for (const value of pile) {
      if (!value || !card(value.id) || typeof value.up !== 'boolean' || (variant === 'freecell' && !value.up) || (sawUp && !value.up)) return false;
      if (value.up) sawUp = true;
      all.push(value.id);
    }
    if (pile.length && !pile.at(-1).up) return false;
  }
  return all.length === 52 && all.every(card) && new Set(all).size === 52;
}

export function restoreState(raw, variant) {
  if (!validateState(raw, variant)) return null;
  const state = { version: 1, ...snapshot(raw), elapsed: count(raw.elapsed), history: [], deal: null };
  state.won = state.foundations.every(p => p.length === 13);
  state.history = Array.isArray(raw.history) ? raw.history.slice(-60).filter(p => validateState(p, variant)).map(snapshot) : [];
  state.deal = validateState(raw.deal, variant) ? snapshot(raw.deal) : snapshot(state);
  return state;
}

export function serializeState(state) {
  return { version: 1, ...snapshot(state), elapsed: count(state.elapsed), history: state.history.slice(-60).map(snapshot), deal: snapshot(state.deal) };
}

export function sourceCards(state, source) {
  if (!source || typeof source !== 'object') return [];
  if (source.type === 'waste') return state.waste.length ? [state.waste.at(-1)] : [];
  if (source.type === 'cell' && Number.isInteger(source.index) && source.index >= 0 && source.index < 4) return state.cells[source.index] === null ? [] : [state.cells[source.index]];
  if (source.type === 'foundation' && Number.isInteger(source.index) && source.index >= 0 && source.index < 4) { const p = state.foundations[source.index]; return p.length ? [p.at(-1)] : []; }
  if (source.type !== 'tableau' || !Number.isInteger(source.index) || source.index < 0 || source.index >= state.tableau.length) return [];
  const pile = state.tableau[source.index], offset = source.offset;
  if (!Number.isInteger(offset) || offset < 0 || offset >= pile.length) return [];
  const sequence = pile.slice(offset);
  if (sequence.some(c => !c.up)) return [];
  for (let i = 1; i < sequence.length; i++) if (rank(sequence[i - 1].id) !== rank(sequence[i].id) + 1 || isRed(sequence[i - 1].id) === isRed(sequence[i].id)) return [];
  return sequence.map(c => c.id);
}

export function moveCapacity(state, destinationIndex) {
  if (state.variant !== 'freecell') return 52;
  const emptyCells = state.cells.filter(c => c === null).length;
  const emptyColumns = state.tableau.filter(p => !p.length).length - (state.tableau[destinationIndex]?.length === 0 ? 1 : 0);
  return (emptyCells + 1) * 2 ** Math.max(0, emptyColumns);
}

export function canMove(state, source, target) {
  if (!state || state.won || !target || !Number.isInteger(target.index)) return false;
  if (source?.type === target.type && source.index === target.index) return false;
  const sequence = sourceCards(state, source);
  if (!sequence.length) return false;
  const first = sequence[0];
  if (target.type === 'foundation') return target.index >= 0 && target.index < 4 && sequence.length === 1 && suit(first) === target.index && rank(first) === state.foundations[target.index].length + 1;
  if (target.type === 'cell') return state.variant === 'freecell' && target.index >= 0 && target.index < 4 && state.cells[target.index] === null && sequence.length === 1;
  if (target.type !== 'tableau' || target.index < 0 || target.index >= state.tableau.length || sequence.length > moveCapacity(state, target.index)) return false;
  const destination = state.tableau[target.index];
  if (!destination.length) return state.variant === 'freecell' || rank(first) === 13;
  const top = destination.at(-1);
  return top.up && rank(top.id) === rank(first) + 1 && isRed(top.id) !== isRed(first);
}

function changed(state, next) {
  next.moves = state.moves + 1;
  next.history = [...state.history.slice(-59), snapshot(state)];
  next.won = next.foundations.every(p => p.length === 13);
  return next;
}

export function moveCard(state, source, target) {
  if (!canMove(state, source, target)) return state;
  const next = { ...state, ...snapshot(state), elapsed: state.elapsed, history: state.history, deal: state.deal };
  const sequence = sourceCards(state, source);
  if (source.type === 'tableau') {
    const pile = next.tableau[source.index]; pile.splice(source.offset);
    if (pile.length) pile.at(-1).up = true;
  } else if (source.type === 'waste') next.waste.pop();
  else if (source.type === 'cell') next.cells[source.index] = null;
  else next.foundations[source.index].pop();
  if (target.type === 'tableau') next.tableau[target.index].push(...sequence.map(id => ({ id, up: true })));
  else if (target.type === 'cell') next.cells[target.index] = sequence[0];
  else next.foundations[target.index].push(sequence[0]);
  return changed(state, next);
}

export function drawCard(state) {
  if (state.variant !== 'solitaire' || state.won || (!state.stock.length && !state.waste.length)) return state;
  const next = { ...state, ...snapshot(state), elapsed: state.elapsed, history: state.history, deal: state.deal };
  if (next.stock.length) next.waste.push(next.stock.pop());
  else { next.stock = next.waste.reverse(); next.waste = []; }
  return changed(state, next);
}

export function undoMove(state) {
  if (!state.history.length) return state;
  return { ...state, ...snapshot(state.history.at(-1)), elapsed: state.elapsed, history: state.history.slice(0, -1) };
}

export function restartDeal(state) {
  return { ...state, ...snapshot(state.deal), elapsed: 0, history: [], won: false };
}

export function allSources(state) {
  const sources = [];
  if (state.waste.length) sources.push({ type: 'waste' });
  state.cells.forEach((id, index) => { if (id !== null) sources.push({ type: 'cell', index }); });
  state.tableau.forEach((pile, index) => pile.forEach((c, offset) => { if (c.up) sources.push({ type: 'tableau', index, offset }); }));
  return sources;
}

export function legalMoves(state) {
  const moves = [];
  for (const source of allSources(state)) {
    const targets = [...Array.from({ length: 4 }, (_, index) => ({ type: 'foundation', index })), ...Array.from({ length: state.tableau.length }, (_, index) => ({ type: 'tableau', index }))];
    if (state.variant === 'freecell') targets.push(...Array.from({ length: 4 }, (_, index) => ({ type: 'cell', index })));
    for (const target of targets) if (canMove(state, source, target)) moves.push({ source, target });
  }
  return moves;
}

export function suggestMove(state) {
  const moves = legalMoves(state);
  return moves.find(m => m.target.type === 'foundation') || moves.find(m => m.source.type === 'tableau' && m.source.offset > 0 && !state.tableau[m.source.index][m.source.offset - 1].up) || moves.find(m => m.target.type === 'tableau' && state.tableau[m.target.index].length) || moves.find(m => m.source.type === 'cell') || moves[0] || null;
}

/** Only automatic safe foundation moves: keep both opposite colors within one rank. */
export function autoFoundation(state) {
  let next = state;
  let moved = 0;
  while (!next.won) {
    const found = legalMoves(next).find(({ source, target }) => {
      if (target.type !== 'foundation') return false;
      const id = sourceCards(next, source)[0], r = rank(id);
      return r <= 2 || next.foundations.every((pile, s) => isRed(s * 13) === isRed(id) || pile.length >= r - 1);
    });
    if (!found) break;
    next = moveCard(next, found.source, found.target); moved++;
  }
  if (!moved) return state;
  // One press of automatic sending is one undoable user action.
  next.history = [...state.history.slice(-59), snapshot(state)];
  return next;
}
