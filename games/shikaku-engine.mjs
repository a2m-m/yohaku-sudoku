const copyRects=rects=>rects.map(rect=>({...rect}));
const same=(a,b)=>a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export function rectangleBetween(a,b,size){if(!integer(a)||!integer(b)||a>=size*size||b>=size*size)return null;const x=Math.min(a%size,b%size),y=Math.min(Math.floor(a/size),Math.floor(b/size));return {x,y,w:Math.abs(a%size-b%size)+1,h:Math.abs(Math.floor(a/size)-Math.floor(b/size))+1};}
export function rectangleCells(rect,size){return Array.from({length:rect.h},(_,y)=>Array.from({length:rect.w},(_,x)=>(rect.y+y)*size+rect.x+x)).flat();}
export function rectangleValid(rect,size){return !!rect&&['x','y','w','h'].every(k=>integer(rect[k]))&&rect.w>0&&rect.h>0&&rect.x+rect.w<=size&&rect.y+rect.h<=size;}
const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
export function clueFor(rect,puzzle){if(!rectangleValid(rect,puzzle.size))return null;const clues=puzzle.clues.filter(c=>c.index%puzzle.size>=rect.x&&c.index%puzzle.size<rect.x+rect.w&&Math.floor(c.index/puzzle.size)>=rect.y&&Math.floor(c.index/puzzle.size)<rect.y+rect.h);return clues.length===1?clues[0]:null;}
export function validRegion(rect,puzzle){const clue=clueFor(rect,puzzle);return !!clue&&clue.value===rect.w*rect.h;}
export function isComplete(rects,puzzle){return Array.isArray(rects)&&rects.every(rect=>validRegion(rect,puzzle))&&rects.every((a,i)=>rects.slice(i+1).every(b=>!overlaps(a,b)))&&rects.reduce((sum,rect)=>sum+rect.w*rect.h,0)===puzzle.size*puzzle.size;}

export function candidatesFor(puzzle){
  const n=puzzle?.size;if(!integer(n)||!n||n>12||!Array.isArray(puzzle.clues)||puzzle.clues.some(c=>!integer(c.index)||c.index>=n*n||!integer(c.value)||!c.value||c.value>n*n)||new Set(puzzle.clues.map(c=>c.index)).size!==puzzle.clues.length)return [];
  return puzzle.clues.map(clue=>{const output=[],cx=clue.index%n,cy=Math.floor(clue.index/n);for(let w=1;w<=n;w++){if(clue.value%w)continue;const h=clue.value/w;if(h>n)continue;for(let y=Math.max(0,cy-h+1);y<=Math.min(cy,n-h);y++)for(let x=Math.max(0,cx-w+1);x<=Math.min(cx,n-w);x++){const rect={x,y,w,h};if(validRegion(rect,puzzle))output.push(rect);}}return output;});
}
export function solvePuzzle(puzzle,limit=2){
  const options=candidatesFor(puzzle),n=puzzle?.size;if(!options.length||options.some(list=>!list.length)||puzzle.clues.reduce((sum,c)=>sum+c.value,0)!==n*n||!(limit>0))return {count:0,solution:null};
  const candidates=options.map((list,clue)=>list.map(rect=>({rect,clue,mask:rectangleCells(rect,n).reduce((mask,i)=>mask|1n<<BigInt(i),0n)}))),byCell=Array.from({length:n*n},()=>[]);
  for(const list of candidates)for(const candidate of list)for(const cell of rectangleCells(candidate.rect,n))byCell[cell].push(candidate);
  const all=(1n<<BigInt(n*n))-1n,used=Array(options.length).fill(false),chosen=[];let count=0,solution=null;
  function visit(occupied){
    if(count>=limit)return;if(occupied===all){count++;if(!solution)solution=copyRects(chosen);return;}
    let choices=null;
    for(let i=0;i<n*n;i++){if(occupied&(1n<<BigInt(i)))continue;const available=byCell[i].filter(c=>!used[c.clue]&&!(c.mask&occupied));if(!available.length)return;if(!choices||available.length<choices.length)choices=available;if(choices.length===1)break;}
    for(const candidate of choices){used[candidate.clue]=true;chosen.push(candidate.rect);visit(occupied|candidate.mask);chosen.pop();used[candidate.clue]=false;if(count>=limit)return;}
  }
  visit(0n);return {count,solution};
}
export const countSolutions=(puzzle,limit=2)=>solvePuzzle(puzzle,limit).count;
const snapshot=game=>({rects:copyRects(game.rects),hints:game.hints});
export function createGame(puzzle,saved=null){
  const valid=entry=>entry&&Array.isArray(entry.rects)&&entry.rects.length<=puzzle.clues.length&&entry.rects.every(rect=>validRegion(rect,puzzle))&&entry.rects.every((a,i)=>entry.rects.slice(i+1).every(b=>!overlaps(a,b)));
  const current=saved?.puzzleId===puzzle.id&&valid(saved)?saved:null;
  const rects=current?copyRects(current.rects):[];
  return {puzzleId:puzzle.id,rects,hints:current&&integer(current.hints)?current.hints:0,elapsed:current&&integer(current.elapsed)?current.elapsed:0,history:current&&Array.isArray(current.history)?current.history.slice(-30).filter(valid).map(entry=>({rects:copyRects(entry.rects),hints:integer(entry.hints)?entry.hints:0})):[],completed:isComplete(rects,puzzle)};
}
function applied(game,puzzle,rects,hints=game.hints){return {changed:true,state:{...game,rects:copyRects(rects),hints,history:[...game.history.slice(-29),snapshot(game)],completed:isComplete(rects,puzzle)}};}
export function placeRectangle(game,puzzle,rect){
  if(game.completed)return {changed:false,state:game};
  if(!validRegion(rect,puzzle))return {changed:false,state:game,error:'数字が1つ入り、その数字と同じ面積になる四角を作りましょう。'};
  if(game.rects.some(old=>same(old,rect)))return {changed:false,state:game};
  return applied(game,puzzle,[...game.rects.filter(old=>!overlaps(old,rect)),{...rect}]);
}
export function removeRegion(game,puzzle,index){if(game.completed||!integer(index)||index>=puzzle.size*puzzle.size)return {changed:false,state:game};const rects=game.rects.filter(rect=>!rectangleCells(rect,puzzle.size).includes(index));return rects.length===game.rects.length?{changed:false,state:game}:applied(game,puzzle,rects);}
export function undo(game,puzzle){if(!game.history.length)return {changed:false,state:game};const previous=game.history.at(-1);return {changed:true,state:{...game,rects:copyRects(previous.rects),hints:previous.hints,history:game.history.slice(0,-1),completed:isComplete(previous.rects,puzzle)}};}
export function wrongRegions(game,puzzle){const solution=puzzle.solution||solvePuzzle(puzzle,1).solution||[];return game.rects.flatMap((rect,index)=>solution.some(answer=>same(rect,answer))?[]:[index]);}
export function hint(game,puzzle){if(game.completed)return {changed:false,state:game};const solution=puzzle.solution||solvePuzzle(puzzle,1).solution;const rect=solution?.find(answer=>!game.rects.some(current=>same(current,answer)));if(!rect)return {changed:false,state:game};return {...applied(game,puzzle,[...game.rects.filter(current=>!overlaps(current,rect)),{...rect}],game.hints+1),rectangle:rect};}
export function serializeGame(game){return {...game,rects:copyRects(game.rects),version:1,history:game.history.slice(game.completed?-1:-30).map(snapshot)};}
