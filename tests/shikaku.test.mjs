import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PUZZLES} from '../games/shikaku-puzzles.mjs';
import {rectangleBetween,rectangleCells,rectangleValid,validRegion,isComplete,candidatesFor,countSolutions,solvePuzzle,createGame,placeRectangle,removeRegion,undo,hint,wrongRegions,serializeGame} from '../games/shikaku-engine.mjs';

test('200 distinct original Shikaku boards cover 5×5, 7×7, 9×9 and have exactly one valid partition',()=>{
  assert.equal(PUZZLES.length,200);assert.deepEqual([5,7,9].map(size=>PUZZLES.filter(p=>p.size===size).length),[60,80,60]);
  assert.deepEqual(PUZZLES.map(p=>p.id),Array.from({length:200},(_,i)=>`sk${String(i+1).padStart(3,'0')}`));
  assert.equal(new Set(PUZZLES.map(p=>`${p.size}:${JSON.stringify(p.clues)}`)).size,200);
  for(const puzzle of PUZZLES){assert.equal(isComplete(puzzle.solution,puzzle),true,puzzle.id);assert.equal(countSolutions(puzzle),1,puzzle.id);assert.equal(isComplete(solvePuzzle(puzzle,1).solution,puzzle),true,puzzle.id);assert.equal(puzzle.clues.reduce((sum,c)=>sum+c.value,0),puzzle.size*puzzle.size);}
});
test('the published 200 puzzle definitions stay fixed for saved progress',()=>{
  assert.equal(createHash('sha256').update(JSON.stringify(PUZZLES)).digest('hex'),'557ac69a6ec8ea91695175eb8c682e82bfe22bfa5148c52aef7410482bebd2c3');
});
test('rectangle selection works in every drag direction and rejects out-of-board corners',()=>{
  assert.deepEqual(rectangleBetween(0,7,5),{x:0,y:0,w:3,h:2});assert.deepEqual(rectangleBetween(7,0,5),rectangleBetween(0,7,5));
  assert.equal(rectangleBetween(-1,0,5),null);assert.equal(rectangleBetween(0,25,5),null);assert.equal(rectangleValid({x:4,y:0,w:2,h:1},5),false);
});
test('solver distinguishes ambiguous, contradictory, and malformed clues without mutating inputs',()=>{
  const puzzle={size:2,clues:[{index:0,value:2},{index:3,value:2}]},before=JSON.stringify(puzzle);
  assert.equal(countSolutions(puzzle),2);assert.equal(countSolutions(puzzle,1),1);assert.equal(countSolutions({...puzzle,clues:[{index:0,value:3}]}),0);assert.equal(countSolutions({...puzzle,clues:[{index:0,value:2},{index:0,value:2}]}),0);assert.equal(countSolutions({size:2,clues:[]}),0);assert.equal(JSON.stringify(puzzle),before);
});
test('cell-first exact cover agrees with independent clue-by-clue enumeration on small puzzles',()=>{
  function independent(puzzle){const options=candidatesFor(puzzle),used=new Set();let count=0;
    function visit(clue){if(count>=2)return;if(clue===options.length){if(used.size===puzzle.size*puzzle.size)count++;return;}for(const rect of options[clue]){const cells=rectangleCells(rect,puzzle.size);if(cells.some(i=>used.has(i)))continue;cells.forEach(i=>used.add(i));visit(clue+1);cells.forEach(i=>used.delete(i));}}
    visit(0);return count;
  }
  for(const puzzle of PUZZLES.filter(p=>p.size===5).slice(0,30))assert.equal(countSolutions(puzzle),independent(puzzle),puzzle.id);
});
test('placing and erasing rectangles are immutable, replace overlaps as one move and undo exactly',()=>{
  const puzzle=PUZZLES[0],initial=createGame(puzzle),rect=puzzle.solution[0],placed=placeRectangle(initial,puzzle,rect);
  assert.equal(placed.changed,true);assert.equal(initial.rects.length,0);assert.equal(placed.state.rects.length,1);assert.equal(placeRectangle(placed.state,puzzle,rect).changed,false);
  assert.equal(placeRectangle(initial,puzzle,{x:0,y:0,w:1,h:1}).changed,false);
  const erased=removeRegion(placed.state,puzzle,0);assert.equal(erased.state.rects.length,0);assert.deepEqual(undo(erased.state,puzzle).state.rects,[rect]);
  const alternative=candidatesFor(puzzle).flat().find(candidate=>!puzzle.solution.some(correct=>JSON.stringify(candidate)===JSON.stringify(correct))&&rectangleCells(candidate,puzzle.size).some(i=>rectangleCells(rect,puzzle.size).includes(i)));
  assert.ok(alternative);const changed=placeRectangle(placed.state,puzzle,alternative);assert.equal(changed.changed,true);assert.equal(changed.state.rects.length,1);assert.deepEqual(undo(changed.state,puzzle).state.rects,[rect]);
});
test('checks identify locally legal mistakes and a hint adds one correct region with reversible changes',()=>{
  const puzzle=PUZZLES[0],wrong=candidatesFor(puzzle).flat().find(rect=>!puzzle.solution.some(answer=>JSON.stringify(rect)===JSON.stringify(answer)));
  assert.equal(validRegion(wrong,puzzle),true);const state=placeRectangle(createGame(puzzle),puzzle,wrong).state;assert.deepEqual(wrongRegions(state,puzzle),[0]);
  const helped=hint(state,puzzle);assert.equal(helped.changed,true);assert.equal(helped.state.hints,1);assert.ok(puzzle.solution.some(rect=>JSON.stringify(rect)===JSON.stringify(helped.rectangle)));assert.deepEqual(undo(helped.state,puzzle).state.rects,state.rects);
});
test('completion uses coverage and region rules regardless of ordering; completed saves retain one Undo',()=>{
  const puzzle=PUZZLES[0];let state=createGame(puzzle);for(const rect of [...puzzle.solution].reverse())state=placeRectangle(state,puzzle,rect).state;
  assert.equal(state.completed,true);assert.equal(isComplete([...puzzle.solution].reverse(),puzzle),true);state.elapsed=123;
  const saved=serializeGame(state);assert.equal(saved.history.length,1);const restored=createGame(puzzle,saved);assert.equal(restored.completed,true);assert.equal(restored.elapsed,123);assert.equal(undo(restored,puzzle).state.completed,false);assert.equal(hint(restored,puzzle).changed,false);
  saved.rects[0].x=999;assert.notEqual(state.rects[0].x,999);
});
test('corrupt saved rectangles, overlaps and foreign IDs cannot fake completion',()=>{
  const puzzle=PUZZLES[0],state=placeRectangle(createGame(puzzle),puzzle,puzzle.solution[0]).state,saved=serializeGame(state);
  assert.equal(createGame(puzzle,{...saved,puzzleId:'other'}).rects.length,0);
  assert.equal(createGame(puzzle,{...saved,rects:[...saved.rects,...saved.rects],completed:true}).rects.length,0);
  assert.equal(createGame(puzzle,{...saved,rects:[{x:0,y:0,w:999,h:1}],completed:true}).completed,false);
  assert.equal(createGame(puzzle,{...saved,history:[null,{},...saved.history]}).history.length,saved.history.length);
});
