import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PUZZLES} from '../games/nonogram-puzzles.mjs';
import {runs,cluesFor,linePatterns,countSolutions,createGame,paintCells,undo,hint,wrongCells,lineMatches,serializeGame,solutionFor} from '../games/nonogram-engine.mjs';

test('200 original pictures cover three sizes with valid cells, distinct IDs and unique solutions',()=>{
  assert.equal(PUZZLES.length,200);
  assert.deepEqual([5,10,15].map(size=>PUZZLES.filter(p=>p.size===size).length),[40,80,80]);
  assert.deepEqual(PUZZLES.map(p=>p.id),Array.from({length:200},(_,i)=>`ng${String(i+1).padStart(3,'0')}`));
  assert.equal(new Set(PUZZLES.map(p=>p.rows.join(''))).size,200);
  for(const puzzle of PUZZLES){assert.equal(puzzle.rows.length,puzzle.size);assert.ok(puzzle.rows.every(row=>row.length===puzzle.size&&/^[01]+$/.test(row)));assert.ok(puzzle.rows.join('').includes('0')&&puzzle.rows.join('').includes('1'));const clues=cluesFor(puzzle.rows);assert.equal(countSolutions(clues.rows,clues.cols),1,`${puzzle.id} ${puzzle.title}`);}
});
test('the first 24 published picture IDs, titles and bitmaps remain byte-for-byte compatible',()=>{
  const digest=createHash('sha256').update(JSON.stringify(PUZZLES.slice(0,24))).digest('hex');
  assert.equal(digest,'620c8752242a4e3bc3733ca7b4947a1df3c60e3e6e9fa7773caffcc9efc77a0f');
});
test('a 15×15 picture can be completed, saved, restored, and undone',()=>{
  const puzzle=PUZZLES.find(p=>p.size===15),game=createGame(puzzle);
  const indices=solutionFor(puzzle).flatMap((filled,i)=>filled?[i]:[]);
  const complete=paintCells(game,puzzle,indices,1).state;
  assert.equal(complete.cells.length,225);assert.equal(complete.completed,true);
  assert.deepEqual(createGame(puzzle,serializeGame(complete)),complete);
  const previous=undo(complete,puzzle).state;
  assert.equal(previous.completed,false);assert.ok(previous.cells.every(cell=>cell===0));
});
test('run clues preserve separated groups, empty lines and ordering',()=>{
  assert.deepEqual(runs([0,1,1,0,1,0,1,1,1]),[2,1,3]);assert.deepEqual(runs([0,0,0]),[0]);
  const patterns=linePatterns([2,1],5);assert.equal(patterns.length,3);assert.ok(patterns.every(line=>JSON.stringify(runs(line))==='[2,1]'));
  assert.deepEqual(linePatterns([0],3),[[0,0,0]]);
  assert.equal(countSolutions([[1],[1]],[[1],[1]]),2);
});
test('painting a complete stroke is immutable and one Undo restores it',()=>{
  const puzzle=PUZZLES[0],game=createGame(puzzle),result=paintCells(game,puzzle,[0,1,2,99,-1],1);
  assert.equal(result.changed,true);assert.deepEqual(game.cells,Array(25).fill(0));assert.deepEqual(result.state.cells.slice(0,4),[1,1,1,0]);assert.equal(result.state.history.length,1);
  assert.deepEqual(undo(result.state,puzzle).state.cells,game.cells);assert.equal(paintCells(game,puzzle,[0],0).changed,false);
});
test('completion requires exactly the filled solution, without crosses in every blank',()=>{
  const puzzle=PUZZLES[0],solution=solutionFor(puzzle);let game=createGame(puzzle);
  const result=paintCells(game,puzzle,solution.flatMap((v,i)=>v?[i]:[]),1);assert.equal(result.state.completed,true);
  assert.equal(result.state.cells.filter(v=>v===-1).length,0);assert.equal(paintCells(result.state,puzzle,[0],1).changed,false);
  const back=undo(result.state,puzzle);assert.equal(back.state.completed,false);
});
test('wrong marks, one-cell hints, and Undo repair mistakes without revealing other cells',()=>{
  const puzzle=PUZZLES[0],solution=solutionFor(puzzle),blank=solution.indexOf(0),filled=solution.indexOf(1);
  let game=paintCells(createGame(puzzle),puzzle,[blank],1).state;game=paintCells(game,puzzle,[filled],-1).state;
  assert.deepEqual(wrongCells(game,puzzle),[blank,filled].sort((a,b)=>a-b));
  const result=hint(game,puzzle);assert.equal(result.changed,true);assert.equal(result.state.hints,1);assert.equal(result.state.cells.filter((v,i)=>v!==game.cells[i]).length,1);
  assert.deepEqual(undo(result.state,puzzle).state.cells,game.cells);assert.equal(undo(result.state,puzzle).state.hints,0);
});
test('saved progress and history round-trip, time stays monotonic and corruption cannot fake a clear',()=>{
  const puzzle=PUZZLES[0];let game=paintCells(createGame(puzzle),puzzle,[0,1],-1).state;game.elapsed=45;
  const saved=serializeGame(game);const restored=createGame(puzzle,saved);assert.deepEqual(restored,game);assert.equal(undo(restored,puzzle).state.elapsed,45);
  saved.cells[0]=1;assert.equal(game.cells[0],-1);
  const invalid=createGame(puzzle,{...saved,cells:[1],completed:true});assert.ok(invalid.cells.every(v=>v===0));assert.equal(invalid.completed,false);
  assert.ok(createGame(puzzle,{...serializeGame(game),puzzleId:'other'}).cells.every(v=>v===0));
});
test('line done state matches clue runs instead of requiring every empty mark',()=>{
  assert.equal(lineMatches([1,1,0,-1,1],[2,1]),true);assert.equal(lineMatches([1,0,1,0,1],[2,1]),false);
  assert.equal(lineMatches([0,-1,0],[0]),true);
});
test('history stays bounded while every edit remains reversible',()=>{
  const puzzle=PUZZLES[0];let game=createGame(puzzle);
  for(let i=0;i<100;i++)game=paintCells(game,puzzle,[0],i%2?0:-1).state;
  assert.equal(game.history.length,40);assert.equal(serializeGame(game).history.length,30);
});
