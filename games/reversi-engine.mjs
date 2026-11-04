const SIZE = 8;
const DIRECTIONS = [-1,0,1].flatMap(row => [-1,0,1].map(col => [row,col])).filter(([row,col]) => row || col);
const validPlayer = player => player === 1 || player === -1;
const validBoard = board => Array.isArray(board) && board.length === 64 && board.every(value => value === 0 || validPlayer(value));
const sameBoard = (a,b) => validBoard(a) && validBoard(b) && a.every((value,index) => value === b[index]);
const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
const nonnegative = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function createGame({mode = 'cpu', difficulty = 'normal', human = 1} = {}) {
  const board = Array(64).fill(0);
  board[27] = board[36] = -1;
  board[28] = board[35] = 1;
  return {board, turn:1, mode:mode === 'local' ? 'local' : 'cpu', difficulty:['easy','normal','hard'].includes(difficulty) ? difficulty : 'normal', human:human === -1 ? -1 : 1, history:[], moves:0, lastMove:null, passed:null, status:'playing', winner:null, elapsed:0};
}

/** All bracketed opponent discs, never crossing a row or including an empty endpoint. */
export function flipsFor(board, index, player) {
  if (!validBoard(board) || !validPlayer(player) || !Number.isInteger(index) || index < 0 || index >= 64 || board[index]) return [];
  return flipsUnchecked(board,index,player);
}

function flipsUnchecked(board,index,player) {
  const row = Math.floor(index / SIZE), col = index % SIZE, flips = [];
  for (const [dr,dc] of DIRECTIONS) {
    const line = [];
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === -player) {
      line.push(r * SIZE + c); r += dr; c += dc;
    }
    if (line.length && r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === player) flips.push(...line);
  }
  return flips;
}

function legalUnchecked(board,player) {
  const moves = [];
  for (let index = 0; index < 64; index++) if (!board[index] && flipsUnchecked(board,index,player).length) moves.push(index);
  return moves;
}

export function legalMoves(board,player) {
  return validBoard(board) && validPlayer(player) ? legalUnchecked(board,player) : [];
}

export function scores(board) {
  const black = board.filter(value => value === 1).length, white = board.filter(value => value === -1).length;
  return {black,white,empty:64 - black - white};
}

function snapshot(state) {
  return {board:state.board.slice(), turn:state.turn, moves:state.moves, lastMove:state.lastMove, passed:state.passed, status:state.status, winner:state.winner};
}

function applyBoard(board,index,player) {
  const next = board.slice(); next[index] = player;
  for (const flip of flipsUnchecked(board,index,player)) next[flip] = player;
  return next;
}

export function playMove(state,index) {
  if (!state || state.status !== 'playing' || !flipsFor(state.board,index,state.turn).length) return {state,changed:false};
  const board = applyBoard(state.board,index,state.turn), opponent = -state.turn;
  let turn = opponent, passed = null, status = 'playing', winner = null;
  if (!legalUnchecked(board,opponent).length) {
    if (legalUnchecked(board,state.turn).length) { turn = state.turn; passed = opponent; }
    else {
      status = 'finished';
      const count = scores(board); winner = Math.sign(count.black - count.white);
    }
  }
  return {state:{...state, board, turn, passed, status, winner, moves:state.moves + 1, lastMove:index, history:[...state.history.slice(-63),snapshot(state)]},changed:true};
}

export function undoMove(state) {
  if (!state?.history?.length) return {state,changed:false};
  const previous = state.history.at(-1);
  return {state:{...state,...snapshot(previous),history:state.history.slice(0,-1)},changed:true};
}

export function serializeGame(state) {
  return {version:1,...state,board:state.board.slice(),history:state.history.map(snapshot),elapsed:nonnegative(state.elapsed)};
}

/** Validate saved play by replaying every move from the standard initial board. */
export function restoreGame(saved) {
  if (!saved || !validBoard(saved.board) || !['cpu','local'].includes(saved.mode) || !['easy','normal','hard'].includes(saved.difficulty) || !validPlayer(saved.human) || !Number.isInteger(saved.moves) || saved.moves < 0 || saved.moves > 60 || !Array.isArray(saved.history) || saved.history.length !== saved.moves) return null;
  let replay = createGame(saved);
  for (let step = 0; step < saved.moves; step++) {
    const before = saved.history[step];
    if (!before || !sameBoard(before.board,replay.board) || before.turn !== replay.turn || before.moves !== step || before.lastMove !== replay.lastMove) return null;
    const nextRecord = step + 1 < saved.moves ? saved.history[step + 1] : saved;
    const result = playMove(replay,nextRecord?.lastMove);
    if (!result.changed) return null;
    replay = result.state;
  }
  if (!sameBoard(saved.board,replay.board) || saved.turn !== replay.turn || saved.lastMove !== replay.lastMove) return null;
  return {...replay,elapsed:nonnegative(saved.elapsed)};
}

const WEIGHTS = [
  100,-25,12,5,5,12,-25,100,
  -25,-45,-4,-3,-3,-4,-45,-25,
  12,-4,4,2,2,4,-4,12,
  5,-3,2,1,1,2,-3,5,
  5,-3,2,1,1,2,-3,5,
  12,-4,4,2,2,4,-4,12,
  -25,-45,-4,-3,-3,-4,-45,-25,
  100,-25,12,5,5,12,-25,100,
];

function evaluate(board,player) {
  let value = 0, discs = 0, empty = 0;
  for (let i = 0; i < 64; i++) { value += board[i] * player * WEIGHTS[i]; discs += board[i] * player; if (!board[i]) empty++; }
  return value + 5 * (legalUnchecked(board,player).length - legalUnchecked(board,-player).length) + discs * (empty < 14 ? 4 : .15);
}
const ordered = moves => moves.slice().sort((a,b) => WEIGHTS[b] - WEIGHTS[a]);

/** Bounded, iterative-deepening negamax; returns a legal move even if budget expires. */
export function chooseMove(board,player,difficulty = 'normal',{random = Math.random,timeLimit,nodeLimit,stats} = {}) {
  const legal = legalMoves(board,player);
  if (!legal.length) return null;
  if (difficulty === 'easy') return legal[Math.max(0,Math.min(legal.length - 1,Math.floor(random() * legal.length)))];
  const hard = difficulty === 'hard', maxDepth = hard ? 5 : 3;
  const deadline = now() + Math.max(1,Math.min(150,timeLimit ?? (hard ? 85 : 35)));
  const maxNodes = Math.max(1,Math.min(20000,nodeLimit ?? (hard ? 10000 : 3000)));
  let nodes = 0, completedDepth = 0, stopped = false, best = ordered(legal)[0];
  const aborted = Symbol('search budget reached');
  function search(position,side,depth,alpha,beta) {
    if (++nodes > maxNodes || (nodes % 8 === 0 && now() >= deadline)) throw aborted;
    const options = legalUnchecked(position,side);
    if (!options.length) {
      if (!legalUnchecked(position,-side).length) {
        const count = scores(position); const difference = side * (count.black - count.white);
        return difference ? Math.sign(difference) * 100000 + difference : 0;
      }
      return -search(position,-side,depth,-beta,-alpha);
    }
    if (!depth) return evaluate(position,side);
    let value = -Infinity;
    for (const index of ordered(options)) {
      value = Math.max(value,-search(applyBoard(position,index,side),-side,depth - 1,-beta,-alpha));
      alpha = Math.max(alpha,value);
      if (alpha >= beta) break;
    }
    return value;
  }
  for (let depth = 1; depth <= maxDepth; depth++) {
    let iterationBest = best, iterationValue = -Infinity;
    try {
      const choices = [best,...ordered(legal).filter(index => index !== best)];
      for (const index of choices) {
        const value = -search(applyBoard(board,index,player),-player,depth - 1,-Infinity,-iterationValue);
        if (value > iterationValue) { iterationValue = value; iterationBest = index; }
      }
      best = iterationBest; completedDepth = depth;
    } catch (error) { if (error !== aborted) throw error; stopped = true; break; }
  }
  if (stats && typeof stats === 'object') Object.assign(stats,{nodes,depth:completedDepth,stopped});
  return best;
}
