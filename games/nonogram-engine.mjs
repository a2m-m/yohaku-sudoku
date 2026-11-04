const copy = value => JSON.parse(JSON.stringify(value));
const validIndex = (i,n) => Number.isInteger(i)&&i>=0&&i<n;
export function runs(line){const output=[];let count=0;for(const value of line){if(Number(value)===1)count++;else if(count){output.push(count);count=0;}}if(count)output.push(count);return output.length?output:[0];}
export function cluesFor(rows){const size=rows.length;return {rows:rows.map(row=>runs(Array.from(row,Number))),cols:Array.from({length:size},(_,col)=>runs(rows.map(row=>Number(row[col]))))};}
export function linePatterns(clues,size){
  if(clues.length===1&&clues[0]===0)return [Array(size).fill(0)];
  const output=[];
  function visit(k,start,line){if(k===clues.length){output.push(line);return;}const remaining=clues.slice(k+1).reduce((sum,n)=>sum+n,0)+clues.length-k-1;for(let offset=start;offset<=size-clues[k]-remaining;offset++){const next=line.slice();for(let i=0;i<clues[k];i++)next[offset+i]=1;visit(k+1,offset+clues[k]+1,next);}}
  visit(0,0,Array(size).fill(0));return output;
}
export function countSolutions(rowClues,colClues,limit=2){
  const size=rowClues.length;if(!size||colClues.length!==size)return 0;
  const rowOptions=rowClues.map(clues=>linePatterns(clues,size)),columns=colClues.map(clues=>linePatterns(clues,size));
  let count=0;
  function visit(row,options){if(count>=limit)return;if(row===size){count++;return;}for(const pattern of rowOptions[row]){const next=options.map((possibilities,col)=>possibilities.filter(line=>line[row]===pattern[col]));if(next.every(list=>list.length))visit(row+1,next);if(count>=limit)return;}}
  visit(0,columns);return count;
}
export function solutionFor(puzzle){return puzzle.rows.flatMap(row=>Array.from(row,Number));}
export function createGame(puzzle,saved=null){
  const count=puzzle.size*puzzle.size,solution=solutionFor(puzzle);
  function snapshot(value){if(!value||!Array.isArray(value.cells)||value.cells.length!==count||!value.cells.every(n=>[-1,0,1].includes(n)))return null;return {cells:value.cells.slice(),hints:Number.isSafeInteger(value.hints)&&value.hints>=0?value.hints:0};}
  const current=saved?.puzzleId===puzzle.id?snapshot(saved):null;
  const cells=current?.cells||Array(count).fill(0);
  return {puzzleId:puzzle.id,cells,hints:current?.hints||0,elapsed:current&&Number.isSafeInteger(saved.elapsed)&&saved.elapsed>=0?saved.elapsed:0,history:current&&Array.isArray(saved.history)?saved.history.slice(-40).map(snapshot).filter(Boolean):[],completed:cells.every((value,i)=>(value===1?1:0)===solution[i])};
}
export function isComplete(game,puzzle){return game.cells.every((value,i)=>(value===1?1:0)===Number(puzzle.rows[Math.floor(i/puzzle.size)][i%puzzle.size]));}
function snapshot(game){return {cells:game.cells.slice(),hints:game.hints};}
function apply(game,puzzle,cells,hints=game.hints){const state={...game,cells,hints,history:[...game.history.slice(-39),snapshot(game)]};state.completed=isComplete(state,puzzle);return {state,changed:true};}
export function paintCells(game,puzzle,indices,value){
  if(game.completed||![-1,0,1].includes(value))return {state:game,changed:false};
  const cells=game.cells.slice();let changed=false;
  for(const index of indices)if(validIndex(index,cells.length)&&cells[index]!==value){cells[index]=value;changed=true;}
  return changed?apply(game,puzzle,cells):{state:game,changed:false};
}
export function undo(game,puzzle){if(!game.history.length)return {state:game,changed:false};const previous=game.history.at(-1),state={...game,...snapshot(previous),history:game.history.slice(0,-1)};state.completed=isComplete(state,puzzle);return {state,changed:true};}
export function hint(game,puzzle){
  if(game.completed)return {state:game,changed:false,index:-1};
  const solution=solutionFor(puzzle);
  let index=game.cells.findIndex((value,i)=>value===1&&solution[i]===0||value===-1&&solution[i]===1);
  if(index<0)index=game.cells.findIndex((value,i)=>value===0&&solution[i]===1);
  if(index<0)index=game.cells.findIndex((value,i)=>value===0);
  if(index<0)return {state:game,changed:false,index:-1};
  const cells=game.cells.slice();cells[index]=solution[index]?1:-1;
  return {...apply(game,puzzle,cells,game.hints+1),index};
}
export function wrongCells(game,puzzle){const solution=solutionFor(puzzle);return game.cells.flatMap((value,i)=>value===1&&solution[i]===0||value===-1&&solution[i]===1?[i]:[]);}
export function lineMatches(line,clues){return JSON.stringify(runs(line.map(value=>value===1?1:0)))===JSON.stringify(clues);}
export function serializeGame(game){return {...copy(game),version:1,history:game.history.slice(-30).map(snapshot)};}
