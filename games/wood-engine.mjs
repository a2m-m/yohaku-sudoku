const SIZE = 9;
const MAX_HISTORY = 40;
const definitions = [
  ['dot','ひとマス',[[0,0]],3],
  ['domino-h','横2マス',[[0,0],[0,1]],3], ['domino-v','縦2マス',[[0,0],[1,0]],3],
  ['line3-h','横3マス',[[0,0],[0,1],[0,2]],3], ['line3-v','縦3マス',[[0,0],[1,0],[2,0]],3],
  ['line4-h','横4マス',[[0,0],[0,1],[0,2],[0,3]],2], ['line4-v','縦4マス',[[0,0],[1,0],[2,0],[3,0]],2],
  ['line5-h','横5マス',[[0,0],[0,1],[0,2],[0,3],[0,4]],1], ['line5-v','縦5マス',[[0,0],[1,0],[2,0],[3,0],[4,0]],1],
  ['square2','2×2の正方形',[[0,0],[0,1],[1,0],[1,1]],3],
  ['square3','3×3の正方形',Array.from({length:9},(_,i)=>[Math.floor(i/3),i%3]),1],
  ['corner-a','小さなL字',[[0,0],[1,0],[1,1]],2], ['corner-b','小さな逆L字',[[0,1],[1,0],[1,1]],2],
  ['corner-c','小さな横L字',[[0,0],[0,1],[1,0]],2], ['corner-d','小さな横逆L字',[[0,0],[0,1],[1,1]],2],
  ['ell-a','大きなL字',[[0,0],[1,0],[2,0],[2,1],[2,2]],1], ['ell-b','大きな逆L字',[[0,2],[1,2],[2,0],[2,1],[2,2]],1],
  ['ell-c','大きな横L字',[[0,0],[0,1],[0,2],[1,0],[2,0]],1], ['ell-d','大きな横逆L字',[[0,0],[0,1],[0,2],[1,2],[2,2]],1],
  ['tee-a','T字',[[0,0],[0,1],[0,2],[1,1]],2], ['tee-b','逆T字',[[0,1],[1,0],[1,1],[1,2]],2],
  ['tee-c','右向きT字',[[0,0],[1,0],[1,1],[2,0]],2], ['tee-d','左向きT字',[[0,1],[1,0],[1,1],[2,1]],2],
  ['zig-h','横ジグザグ',[[0,1],[0,2],[1,0],[1,1]],1], ['zig-v','縦ジグザグ',[[0,0],[1,0],[1,1],[2,1]],1],
];
export const SHAPES = Object.fromEntries(definitions.map(([id,label,cells,weight])=>[id,{id,label,cells,width:Math.max(...cells.map(c=>c[1]))+1,height:Math.max(...cells.map(c=>c[0]))+1,weight}]));
const pool = definitions.flatMap(([id,,,weight])=>Array(weight).fill(id));
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
export const validWoodBoard = board => Array.isArray(board) && board.length===81 && board.every(value=>value===0||value===1);
const validTray = tray => Array.isArray(tray)&&tray.length===3&&tray.some(Boolean)&&tray.every(id=>id===null||Object.hasOwn(SHAPES,id));
const pick = random => {const value=Number(random());return pool[Math.min(pool.length-1,Math.max(0,Math.floor((Number.isFinite(value)?value:0)*pool.length)))];};

export function shapeCells(shapeId,anchor) {
  const shape=SHAPES[shapeId];
  if(!shape||!Number.isInteger(anchor)||anchor<0||anchor>=81)return null;
  const row=Math.floor(anchor/SIZE),col=anchor%SIZE;
  if(row+shape.height>SIZE||col+shape.width>SIZE)return null;
  return shape.cells.map(([r,c])=>(row+r)*SIZE+col+c);
}
export function canPlace(board,shapeId,anchor) {
  if(!validWoodBoard(board))return false;
  const cells=shapeCells(shapeId,anchor);
  return Boolean(cells&&cells.every(index=>!board[index]));
}
export function legalPlacements(board,shapeId) {
  return Array.from({length:81},(_,index)=>index).filter(index=>canPlace(board,shapeId,index));
}
export function hasAnyMove(board,tray) {
  return validWoodBoard(board)&&Array.isArray(tray)&&tray.some(id=>id&&legalPlacements(board,id).length);
}

/** Evaluate all 27 units on the same board, then clear their union once. */
export function clearCompleted(board) {
  const rows=[],cols=[],boxes=[],cleared=new Set();
  for(let n=0;n<SIZE;n++) {
    const row=Array.from({length:9},(_,i)=>n*9+i),col=Array.from({length:9},(_,i)=>i*9+n);
    const box=Array.from({length:9},(_,i)=>Math.floor(n/3)*27+(n%3)*3+Math.floor(i/3)*9+i%3);
    for(const [cells,units] of [[row,rows],[col,cols],[box,boxes]])if(cells.every(index=>board[index]===1)){units.push(n);cells.forEach(index=>cleared.add(index));}
  }
  const indices=[...cleared].sort((a,b)=>a-b),next=board.slice();indices.forEach(index=>next[index]=0);
  return {board:next,cleared:indices,units:{rows,cols,boxes},unitCount:rows.length+cols.length+boxes.length};
}

/** If a random tray cannot move, replace one piece with a shape that fits. */
export function dealPieces(board,random=Math.random) {
  const tray=Array.from({length:3},()=>pick(random));
  if(hasAnyMove(board,tray))return tray;
  const fitting=Object.keys(SHAPES).filter(id=>legalPlacements(board,id).length);
  if(fitting.length){const value=Number(random());tray[0]=fitting[Math.min(fitting.length-1,Math.max(0,Math.floor((Number.isFinite(value)?value:0)*fitting.length)))];}
  return tray;
}
export function createWood(random=Math.random) {
  const board=Array(81).fill(0),tray=dealPieces(board,random);
  return {board,tray,score:0,moves:0,clearedTotal:0,over:false,history:[],lastPlaced:[],lastCleared:[],lastUnits:0,gain:0};
}
function snapshot(state) {return {board:state.board.slice(),tray:state.tray.slice(),score:state.score,moves:state.moves,clearedTotal:state.clearedTotal};}

export function placeWood(state,trayIndex,anchor,random=Math.random) {
  if(!state||state.over||!Number.isInteger(trayIndex)||trayIndex<0||trayIndex>2||!state.tray[trayIndex]||!canPlace(state.board,state.tray[trayIndex],anchor))return {state,changed:false};
  const placed=shapeCells(state.tray[trayIndex],anchor),board=state.board.slice();placed.forEach(index=>board[index]=1);
  const cleared=clearCompleted(board);
  let tray=state.tray.slice();tray[trayIndex]=null;
  if(tray.every(id=>id===null))tray=dealPieces(cleared.board,random);
  // Each placed/cleared cell counts once, plus ten points for every completed unit.
  const gained=placed.length+cleared.cleared.length+10*cleared.unitCount;
  return {state:{board:cleared.board,tray,score:state.score+gained,moves:state.moves+1,clearedTotal:state.clearedTotal+cleared.unitCount,over:!hasAnyMove(cleared.board,tray),history:[...state.history.slice(-(MAX_HISTORY-1)),snapshot(state)],lastPlaced:placed,lastCleared:cleared.cleared,lastUnits:cleared.unitCount,gain:gained},changed:true,gained,cleared:cleared.cleared,units:cleared.units};
}
export function undoWood(state) {
  if(!state?.history?.length)return {state,changed:false};
  const previous=state.history.at(-1);
  return {state:{...snapshot(previous),over:!hasAnyMove(previous.board,previous.tray),history:state.history.slice(0,-1),lastPlaced:[],lastCleared:[],lastUnits:0,gain:0},changed:true};
}
function restoreSnapshot(saved) {
  if(!saved||!validWoodBoard(saved.board)||!validTray(saved.tray))return null;
  return {board:saved.board.slice(),tray:saved.tray.slice(),score:count(saved.score),moves:count(saved.moves),clearedTotal:count(saved.clearedTotal)};
}
export function restoreWood(saved) {
  const restored=restoreSnapshot(saved);if(!restored)return null;
  const history=Array.isArray(saved.history)?saved.history.slice(-MAX_HISTORY).map(restoreSnapshot).filter(Boolean):[];
  return {...restored,over:!hasAnyMove(restored.board,restored.tray),history,lastPlaced:[],lastCleared:[],lastUnits:0,gain:0};
}
export function serializeWood(state) {return {version:1,...snapshot(state),history:state.history.slice(-MAX_HISTORY).map(snapshot)};}
