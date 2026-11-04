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
  const size=rowClues?.length;
  if(!Array.isArray(rowClues)||!Array.isArray(colClues)||!size||colClues.length!==size||limit<=0)return 0;
  const valid=clues=>Array.isArray(clues)&&(clues.length===0||clues.length===1&&clues[0]===0||clues.every(n=>Number.isInteger(n)&&n>0)&&clues.reduce((sum,n)=>sum+n,0)+clues.length-1<=size);
  if(!rowClues.every(valid)||!colClues.every(valid))return 0;
  const total=clues=>clues.reduce((sum,line)=>sum+line.reduce((n,value)=>n+value,0),0);
  if(total(rowClues)!==total(colClues))return 0;
  const rows=rowClues.map(clues=>linePatterns(clues,size)),cols=colClues.map(clues=>linePatterns(clues,size));
  let count=0;
  // Bit 1 permits an empty cell, bit 2 permits a filled cell. Supporting both
  // values keeps a candidate alive; a forced value prunes the crossing line.
  const supports=domains=>domains.map(options=>{const cells=new Uint8Array(size);for(const line of options)for(let i=0;i<size;i++)cells[i]|=1<<line[i];return cells;});
  function propagate(rowDomains,colDomains){
    let changed;
    do{
      changed=false;
      const colSupports=supports(colDomains);
      for(let r=0;r<size;r++){
        const before=rowDomains[r],next=before.filter(line=>line.every((value,c)=>colSupports[c][r]&(1<<value)));
        if(!next.length)return false;
        if(next.length!==before.length){rowDomains[r]=next;changed=true;}
      }
      const rowSupports=supports(rowDomains);
      for(let c=0;c<size;c++){
        const before=colDomains[c],next=before.filter(line=>line.every((value,r)=>rowSupports[r][c]&(1<<value)));
        if(!next.length)return false;
        if(next.length!==before.length){colDomains[c]=next;changed=true;}
      }
    }while(changed);
    return true;
  }
  function visit(rowDomains,colDomains){
    if(count>=limit||!propagate(rowDomains,colDomains))return;
    let chosen=null,index=-1,min=Infinity;
    for(const domains of [rowDomains,colDomains])for(let i=0;i<size;i++)if(domains[i].length>1&&domains[i].length<min){chosen=domains;index=i;min=domains[i].length;}
    if(!chosen){count++;return;}
    // Branch on the most constrained line, including columns. Each branch is
    // isolated: candidate lines are immutable and only domain arrays change.
    for(const line of chosen[index]){
      const nextRows=rowDomains.slice(),nextCols=colDomains.slice();
      (chosen===rowDomains?nextRows:nextCols)[index]=[line];
      visit(nextRows,nextCols);
      if(count>=limit)return;
    }
  }
  visit(rows,cols);return count;
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
export function serializeGame(game){return {...copy(game),version:1,history:game.history.slice(game.completed?-1:-30).map(snapshot)};}
