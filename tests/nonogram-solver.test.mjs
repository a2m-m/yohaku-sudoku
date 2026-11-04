import test from 'node:test';
import assert from 'node:assert/strict';
import {cluesFor,countSolutions,createGame,paintCells,serializeGame,undo,solutionFor} from '../games/nonogram-engine.mjs';

// Deliberately independent reference: enumerate every binary row and search
// top-to-bottom. This is small enough for 5×5 and shares no candidate builder
// or propagation code with the production solver.
function referenceCount(rowClues,colClues,limit=2){
  const n=rowClues.length;
  const groups=line=>{const out=[];let run=0;for(const value of [...line,0]){if(value)run++;else if(run){out.push(run);run=0;}}return out.length?out:[0];};
  const all=Array.from({length:2**n},(_,bits)=>Array.from({length:n},(_,i)=>(bits>>i)&1));
  const possibilities=clues=>all.filter(line=>JSON.stringify(groups(line))===JSON.stringify(clues));
  const rows=rowClues.map(possibilities),cols=colClues.map(possibilities);
  let count=0;
  function search(row,columns){
    if(count>=limit)return;
    if(row===n){count++;return;}
    for(const line of rows[row]){
      const next=columns.map((options,col)=>options.filter(option=>option[row]===line[col]));
      if(next.every(options=>options.length))search(row+1,next);
      if(count>=limit)return;
    }
  }
  search(0,cols);return count;
}

test('propagation solver agrees with independent exhaustive search on small boards',()=>{
  let seed=314159;
  const bit=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>31;};
  for(let trial=0;trial<80;trial++){
    const rows=Array.from({length:5},()=>Array.from({length:5},bit).join(''));
    const clues=cluesFor(rows);
    assert.equal(countSolutions(clues.rows,clues.cols,3),referenceCount(clues.rows,clues.cols,3),rows.join('/'));
  }
});

test('ambiguous counts respect the requested cutoff, including exact totals',()=>{
  const clues=Array.from({length:3},()=>[1]);
  assert.equal(countSolutions(clues,clues,1),1);
  assert.equal(countSolutions(clues,clues,2),2);
  assert.equal(countSolutions(clues,clues,3),3);
  assert.equal(countSolutions(clues,clues,10),6);
  assert.equal(countSolutions(clues,clues,Infinity),6);
  assert.equal(countSolutions(clues,clues,0),0);
});

test('empty lines, contradictory crossings and malformed clues are handled',()=>{
  assert.equal(countSolutions([[0],[0]],[[0],[0]]),1);
  assert.equal(countSolutions([[],[]],[[],[]]),1);
  assert.equal(countSolutions([[2],[0]],[[0],[2]]),0);
  assert.equal(countSolutions([[1],[0]],[[0],[0]]),0);
  assert.equal(countSolutions([[3],[0]],[[1],[1]]),0);
  assert.equal(countSolutions([[0,1],[0]],[[1],[0]]),0);
  assert.equal(countSolutions([[1]],[]),0);
  assert.equal(countSolutions(null,[]),0);
});

test('15×15 unique and ambiguous boards preserve their input clues',()=>{
  const picture=Array.from({length:15},(_,r)=>'1'.repeat(r+1)+'0'.repeat(14-r));
  const clues=cluesFor(picture);
  for(const list of [clues.rows,clues.cols]){list.forEach(Object.freeze);Object.freeze(list);}
  const before=JSON.stringify(clues);
  assert.equal(countSolutions(clues.rows,clues.cols),1);
  assert.equal(JSON.stringify(clues),before);
  const permutation=Array.from({length:15},()=>[1]);
  assert.equal(countSolutions(permutation,permutation,3),3);
});

test('completed pictures persist a compact history while retaining one Undo after reload',()=>{
  const puzzle={id:'compact',size:5,rows:['01010','11111','11111','01110','00100']};
  let game=createGame(puzzle);
  for(const [i,value] of solutionFor(puzzle).entries())if(value)game=paintCells(game,puzzle,[i],1).state;
  assert.equal(game.completed,true);assert.ok(game.history.length>1);
  const saved=serializeGame(game);
  assert.equal(saved.history.length,1);
  const restored=createGame(puzzle,saved);
  assert.equal(restored.completed,true);
  const previous=undo(restored,puzzle);
  assert.equal(previous.changed,true);assert.equal(previous.state.completed,false);
  assert.equal(previous.state.cells.filter(value=>value===1).length,15);
  assert.equal(game.history.length,16,'serialization must not mutate active history');
});
