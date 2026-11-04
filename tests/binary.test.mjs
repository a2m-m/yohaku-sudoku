import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PUZZLES} from '../games/binary-puzzles.mjs';
import {linePatterns,countSolutions,solve,generateSolution,ruleViolations,isComplete,createGame,enterCell,undo,hint,wrongCells,serializeGame} from '../games/binary-engine.mjs';

function independentlyValid(cells,n){
  if(cells.length!==n*n||!cells.every(v=>v===1||v===2))return false;
  const rows=Array.from({length:n},(_,r)=>cells.slice(r*n,(r+1)*n)),cols=Array.from({length:n},(_,c)=>Array.from({length:n},(_,r)=>cells[r*n+c]));
  for(const lines of [rows,cols]){if(new Set(lines.map(row=>row.join(''))).size!==n)return false;for(const line of lines)if(line.filter(v=>v===1).length!==n/2||line.some((v,i)=>i>=2&&v===line[i-1]&&v===line[i-2]))return false;}
  return true;
}
test('200 original binary puzzles have distinct stable IDs, independent answers and one solution',()=>{
  assert.equal(PUZZLES.length,200);assert.deepEqual([6,8,10].map(n=>PUZZLES.filter(p=>p.size===n).length),[80,80,40]);
  assert.deepEqual(PUZZLES.map(p=>p.id),Array.from({length:200},(_,i)=>`bn${String(i+1).padStart(3,'0')}`));
  assert.equal(new Set(PUZZLES.map(p=>p.solution)).size,200);assert.equal(new Set(PUZZLES.map(p=>p.givens)).size,200);
  for(const p of PUZZLES){const givens=Array.from(p.givens,Number),solution=Array.from(p.solution,Number);assert.equal(p.givens.length,p.size*p.size);assert.match(p.givens,/^[012]+$/);assert.ok(independentlyValid(solution,p.size),p.id);assert.ok(givens.every((v,i)=>!v||v===solution[i]));assert.equal(countSolutions(givens,p.size),1,p.id);assert.deepEqual(solve(givens,p.size),solution,p.id);assert.equal(givens.join(''),p.givens);assert.ok(givens.includes(0));}
});
test('the first release of 200 puzzles keeps its ID-to-board mapping',()=>{
  assert.equal(createHash('sha256').update(JSON.stringify(PUZZLES.slice(0,200))).digest('hex'),'5e2e3a341101d54ba4dbd2407ca75d7ce99d955be199b5b8ba8a25192070acb0');
});
test('the solver matches an independent exhaustive 4×4 enumerator on 80 partial boards',()=>{
  const rows=[];for(let value=0;value<16;value++){const row=Array.from({length:4},(_,i)=>value&(1<<i)?2:1);if(row.filter(v=>v===1).length===2)rows.push(row);}
  const answers=[];for(const a of rows)for(const b of rows)for(const c of rows)for(const d of rows){const cells=[...a,...b,...c,...d];if(independentlyValid(cells,4))answers.push(cells);}
  assert.ok(answers.length>10);let seed=30217;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let attempt=0;attempt<80;attempt++){const answer=answers[Math.floor(random()*answers.length)],cells=answer.map(v=>random()<.45?v:0);if(attempt%7===0)cells[0]=cells[1]=cells[2]=1;const expected=Math.min(2,answers.filter(a=>cells.every((v,i)=>!v||v===a[i])).length);assert.equal(countSolutions(cells,4),expected);}
  assert.equal(countSolutions(Array(16).fill(0),4,1),1);assert.equal(countSolutions(Array(16).fill(0),4),2);
});
test('invalid inputs and row/column rule violations are rejected without mutation',()=>{
  assert.equal(countSolutions([],0),0);assert.equal(countSolutions(Array(25).fill(0),5),0);assert.equal(countSolutions(Array(36).fill(3),6),0);assert.equal(solve([0],6),null);assert.equal(isComplete([],0),false);
  const triplet=Array(36).fill(0);triplet[0]=triplet[1]=triplet[2]=1;assert.deepEqual(ruleViolations(triplet,6),[0,1,2]);assert.equal(countSolutions(triplet,6),0);
  const half=Array(36).fill(0);[0,1,3,5].forEach(i=>half[i]=2);assert.deepEqual(ruleViolations(half,6),[0,1,3,5]);
  const duplicate=Array(36).fill(0);duplicate.splice(0,12,...[1,1,2,1,2,2,1,1,2,1,2,2]);assert.ok(ruleViolations(duplicate,6).length>=12);assert.equal(countSolutions(duplicate,6),0);
  assert.deepEqual(triplet.slice(0,4),[1,1,1,0]);assert.equal(linePatterns(5).length,0);
});
test('seeded completed grids obey every rule, including allowed row-column matches',()=>{
  let seed=1;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const n of [4,6,8,10]){const result=generateSolution(n,random);assert.equal(independentlyValid(result,n),true);assert.equal(isComplete(result,n),true);}
  const cells=[1,1,2,2,1,2,1,2,2,1,2,1,2,2,1,1];assert.equal(independentlyValid(cells,4),true);assert.equal(isComplete(cells,4),true);
});
test('inputs preserve fixed clues and undo a change without mutating earlier boards',()=>{
  const p=PUZZLES[0],game=createGame(p),index=p.givens.indexOf('0'),fixed=p.givens.search(/[12]/),result=enterCell(game,p,index,1);
  assert.equal(result.changed,true);assert.equal(game.cells[index],0);assert.equal(result.state.cells[index],1);assert.equal(result.state.moves,1);assert.equal(enterCell(game,p,fixed,0).changed,false);assert.equal(enterCell(game,p,-1,1).changed,false);
  result.state.elapsed=19;const back=undo(result.state,p);assert.equal(back.state.cells[index],0);assert.equal(back.state.elapsed,19);assert.equal(back.state.moves,0);
});
test('hints repair wrong cells before blanks, count only one cell and are undoable',()=>{
  const p=PUZZLES[0],index=p.givens.indexOf('0'),wrong=Number(p.solution[index])===1?2:1,game=enterCell(createGame(p),p,index,wrong).state;
  assert.deepEqual(wrongCells(game,p),[index]);const result=hint(game,p);assert.equal(result.index,index);assert.equal(result.state.hints,1);assert.equal(result.state.cells.filter((v,i)=>v!==game.cells[i]).length,1);assert.deepEqual(wrongCells(result.state,p),[]);assert.deepEqual(undo(result.state,p).state.cells,game.cells);
});
test('save corruption cannot overwrite clues or fake completion and completed saves retain one undo',()=>{
  const p=PUZZLES[0];let game=createGame(p);for(let i=0;i<game.cells.length;i++)if(!game.cells[i])game=enterCell(game,p,i,Number(p.solution[i])).state;
  game.elapsed=250;assert.equal(game.completed,true);const saved=serializeGame(game);assert.equal(saved.history.length,1);const restored=createGame(p,saved);assert.equal(restored.completed,true);assert.equal(restored.elapsed,250);assert.equal(undo(restored,p).state.completed,false);assert.equal(undo(restored,p).state.elapsed,250);
  saved.cells[0]=0;const invalid=createGame(p,saved);assert.equal(invalid.completed,false);assert.equal(invalid.cells[0],Number(p.givens[0]));assert.equal(createGame(p,{...serializeGame(game),puzzleId:'other'}).completed,false);
  const forged=createGame(p,{puzzleId:p.id,cells:Array.from(p.givens,Number),completed:true});assert.equal(forged.completed,false);
});
test('unfinished save histories are bounded at 30 with independent arrays',()=>{
  const p=PUZZLES[0],index=p.givens.indexOf('0');let game=createGame(p);for(let i=0;i<80;i++)game=enterCell(game,p,index,i%2?0:1).state;
  const saved=serializeGame(game);assert.equal(saved.history.length,30);saved.history[0].cells[index]=2;assert.notDeepEqual(saved.history[0].cells,game.history[0].cells);assert.equal(createGame(p,serializeGame(game)).history.length,30);
});
