const patternCache=new Map();
const validSize=n=>Number.isInteger(n)&&n>=4&&n<=12&&n%2===0;
const validCells=(cells,n)=>Array.isArray(cells)&&cells.length===n*n&&cells.every(v=>v===0||v===1||v===2);
export function linePatterns(size){
  if(!validSize(size))return [];
  if(!patternCache.has(size)){
    const patterns=[];
    for(let mask=0;mask<2**size;mask++){
      const cells=Array.from({length:size},(_,i)=>mask&(1<<i)?2:1);
      if(cells.filter(v=>v===1).length!==size/2||cells.some((v,i)=>i>1&&v===cells[i-1]&&v===cells[i-2]))continue;
      patterns.push(Object.freeze(cells));
    }
    patternCache.set(size,Object.freeze(patterns));
  }
  return patternCache.get(size);
}
function solveSearch(cells,size,limit=2,random=null){
  if(!validSize(size)||!validCells(cells,size)||!(limit>0))return [];
  const shuffled=values=>{const out=values.slice();if(random)for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  const patterns=linePatterns(size);
  const rows=Array.from({length:size},(_,r)=>shuffled(patterns.filter(line=>line.every((v,c)=>!cells[r*size+c]||cells[r*size+c]===v))));
  const cols=Array.from({length:size},(_,c)=>shuffled(patterns.filter(line=>line.every((v,r)=>!cells[r*size+c]||cells[r*size+c]===v))));
  const answers=[];
  const supports=domains=>domains.map(options=>{const values=Array(size).fill(0);for(const line of options)for(let i=0;i<size;i++)values[i]|=line[i]===1?1:2;return values;});
  function propagate(a,b){
    let changed;
    do{
      changed=false;
      for(const domains of [a,b]){
        const singles=domains.filter(d=>d.length===1).map(d=>d[0]);
        if(singles.length!==new Set(singles).size)return false;
        const fixed=new Set(singles);
        for(let i=0;i<size;i++)if(domains[i].length>1){const next=domains[i].filter(p=>!fixed.has(p));if(!next.length)return false;if(next.length!==domains[i].length){domains[i]=next;changed=true;}}
        if(domains.some(d=>!d.length))return false;
      }
      const bs=supports(b);
      for(let r=0;r<size;r++){const before=a[r],next=before.filter(line=>line.every((v,c)=>bs[c][r]&(v===1?1:2)));if(!next.length)return false;if(next.length!==before.length){a[r]=next;changed=true;}}
      const as=supports(a);
      for(let c=0;c<size;c++){const before=b[c],next=before.filter(line=>line.every((v,r)=>as[r][c]&(v===1?1:2)));if(!next.length)return false;if(next.length!==before.length){b[c]=next;changed=true;}}
    }while(changed);
    return true;
  }
  function visit(a,b){
    if(answers.length>=limit||!propagate(a,b))return;
    let chosen=null,index=-1,min=Infinity;
    for(const domains of [a,b])for(let i=0;i<size;i++)if(domains[i].length>1&&domains[i].length<min){chosen=domains;index=i;min=domains[i].length;}
    if(!chosen){answers.push(a.flatMap(d=>d[0]));return;}
    for(const line of chosen[index]){const nextA=a.slice(),nextB=b.slice();(chosen===a?nextA:nextB)[index]=[line];visit(nextA,nextB);if(answers.length>=limit)return;}
  }
  visit(rows,cols);return answers;
}
export function countSolutions(cells,size,limit=2){return solveSearch(cells,size,limit).length;}
export function solve(cells,size){return solveSearch(cells,size,1)[0]||null;}
export function generateSolution(size,random=Math.random){return solveSearch(Array(size*size).fill(0),size,1,random)[0]||null;}
export function ruleViolations(cells,size){
  if(!validSize(size)||!validCells(cells,size))return [];
  const errors=new Set();
  for(let axis=0;axis<2;axis++){
    const lines=Array.from({length:size},(_,a)=>Array.from({length:size},(_,b)=>axis?b*size+a:a*size+b));
    for(const indices of lines){
      const line=indices.map(i=>cells[i]);
      for(let i=2;i<size;i++)if(line[i]&&line[i]===line[i-1]&&line[i]===line[i-2])for(let j=i-2;j<=i;j++)errors.add(indices[j]);
      for(const value of [1,2])if(line.filter(v=>v===value).length>size/2)indices.forEach(i=>{if(cells[i]===value)errors.add(i);});
    }
    for(let a=0;a<size;a++)for(let b=a+1;b<size;b++)if(lines[a].every((i,k)=>cells[i]&&cells[i]===cells[lines[b][k]])){lines[a].forEach(i=>errors.add(i));lines[b].forEach(i=>errors.add(i));}
  }
  return [...errors].sort((a,b)=>a-b);
}
export function isComplete(cells,size){return validSize(size)&&validCells(cells,size)&&cells.every(Boolean)&&ruleViolations(cells,size).length===0;}
const natural=v=>Number.isSafeInteger(v)&&v>=0?v:0;
const givensFor=puzzle=>Array.from(puzzle.givens,Number);
function snapshot(value,puzzle){
  const givens=givensFor(puzzle);
  if(!value||!validCells(value.cells,puzzle.size)||!givens.every((v,i)=>!v||v===value.cells[i]))return null;
  return {cells:value.cells.slice(),hints:natural(value.hints),moves:natural(value.moves)};
}
export function createGame(puzzle,saved=null){
  const current=saved?.puzzleId===puzzle.id?snapshot(saved,puzzle):null,cells=current?.cells||givensFor(puzzle);
  return {puzzleId:puzzle.id,cells,hints:current?.hints||0,moves:current?.moves||0,elapsed:current?natural(saved.elapsed):0,history:current&&Array.isArray(saved.history)?saved.history.slice(-30).map(value=>snapshot(value,puzzle)).filter(Boolean):[],completed:isComplete(cells,puzzle.size)};
}
export function enterCell(game,puzzle,index,value){
  if(game.completed||!Number.isInteger(index)||index<0||index>=game.cells.length||![0,1,2].includes(value)||puzzle.givens[index]!=='0'||game.cells[index]===value)return {state:game,changed:false};
  const cells=game.cells.slice();cells[index]=value;
  return {state:{...game,cells,moves:game.moves+1,history:[...game.history.slice(-29),snapshot(game,puzzle)],completed:isComplete(cells,puzzle.size)},changed:true};
}
export function undo(game,puzzle){if(!game.history.length)return {state:game,changed:false};const previous=game.history.at(-1);return {state:{...game,...snapshot(previous,puzzle),history:game.history.slice(0,-1),completed:isComplete(previous.cells,puzzle.size)},changed:true};}
export function hint(game,puzzle){
  if(game.completed)return {state:game,changed:false,index:-1};
  let index=game.cells.findIndex((v,i)=>puzzle.givens[i]==='0'&&v&&v!==Number(puzzle.solution[i]));
  if(index<0)index=game.cells.findIndex(v=>v===0);
  if(index<0)return {state:game,changed:false,index:-1};
  const result=enterCell(game,puzzle,index,Number(puzzle.solution[index]));
  if(result.changed)result.state.hints=game.hints+1;
  return {...result,index};
}
export function wrongCells(game,puzzle){return game.cells.flatMap((value,i)=>value&&value!==Number(puzzle.solution[i])?[i]:[]);}
export function serializeGame(game){return {...game,cells:game.cells.slice(),version:1,history:game.history.slice(game.completed?-1:-30).map(s=>({cells:s.cells.slice(),hints:s.hints,moves:s.moves}))};}
