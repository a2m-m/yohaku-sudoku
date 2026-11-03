import test from 'node:test';
import assert from 'node:assert/strict';
import { create2048, slide2048, move2048, undo2048, canMove2048, createFifteen, solvedFifteen, isFifteenSolvable, isFifteenSolved, fifteenNeighbors, moveFifteen, moveFifteenBlank, undoFifteen, restoreNumberGame } from '../games/numbers-engine.mjs';

const rowBoard = row => [...row, ...Array(12).fill(0)];
for (const [row, expected, score] of [
  [[2,2,2,2],[4,4,0,0],8], [[2,2,4,0],[4,4,0,0],4], [[4,0,4,4],[8,4,0,0],8],
  [[0,2,0,2],[4,0,0,0],4], [[2,4,8,16],[2,4,8,16],0], [[4,4,8,8],[8,16,0,0],24],
  [[0,0,0,2],[2,0,0,0],0], [[0,0,0,0],[0,0,0,0],0],
]) test(`2048 merges ${row} once per move`, () => {
  const board = rowBoard(row), result = slide2048(board, 'left');
  assert.deepEqual(result.board.slice(0,4),expected);assert.equal(result.score,score);assert.deepEqual(board,rowBoard(row));
});
test('2048 handles all four directions with the correct edge',()=>{
  const board=Array(16).fill(0);board[0]=2;board[4]=2;
  assert.equal(slide2048(board,'up').board[0],4);
  assert.equal(slide2048(board,'down').board[12],4);
  assert.equal(slide2048(rowBoard([2,2,0,0]),'right').board[3],4);
});
test('2048 no-op does not consume randomness or add a tile',()=>{
  const state={...create2048(()=>0),board:rowBoard([2,4,8,16])};
  let calls=0;const result=move2048(state,'left',()=>{calls++;return 0;});
  assert.equal(result.changed,false);assert.equal(result.state,state);assert.equal(calls,0);
});
test('2048 move spawns once, scores and Undo restores the exact pre-spawn board',()=>{
  const state={...create2048(()=>0),board:rowBoard([2,2,0,0])};
  const next=move2048(state,'left',()=>0).state;
  assert.deepEqual(next.board.slice(0,4),[4,2,0,0]);assert.equal(next.score,4);assert.equal(next.moves,1);
  assert.deepEqual(undo2048(next).state.board,state.board);assert.equal(undo2048(next).state.score,0);
});
test('2048 win and blocked board are derived correctly',()=>{
  const state={...create2048(()=>0),board:rowBoard([1024,1024,0,0])};
  assert.equal(move2048(state,'left',()=>0).state.won,true);
  const full=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];
  assert.equal(canMove2048(full),false);full[1]=2;assert.equal(canMove2048(full),true);
  assert.equal(restoreNumberGame('2048',{board:[2,4]}).moves,0);
});
test('15-puzzle shuffle is always solvable, unsolved and contains every tile',()=>{
  let seed=19;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  for(let i=0;i<100;i++){const state=createFifteen(random);assert.equal(isFifteenSolvable(state.board),true);assert.equal(isFifteenSolved(state.board),false);assert.equal(new Set(state.board).size,16);}
});
test('15-puzzle detects unsolvable parity and malformed saved state',()=>{
  const board=solvedFifteen();[board[0],board[1]]=[board[1],board[0]];
  assert.equal(isFifteenSolvable(board),false);assert.equal(isFifteenSolvable(Array(16).fill(0)),false);
  assert.equal(restoreNumberGame('fifteen',{board}).completed,false);
});
test('15-puzzle only moves adjacent tiles and never wraps rows',()=>{
  const state={board:solvedFifteen(),moves:0,elapsed:11,completed:false,history:[]};
  assert.deepEqual(fifteenNeighbors(0),[1,4]);assert.equal(moveFifteen(state,0).changed,false);
  assert.equal(moveFifteenBlank(state,'right').changed,false);
  const next=moveFifteen(state,14).state;assert.equal(next.board[15],15);assert.equal(next.board[14],0);assert.equal(next.moves,1);
  assert.deepEqual(undoFifteen({...next,elapsed:20}).state.board,state.board);assert.equal(undoFifteen({...next,elapsed:20}).state.elapsed,20);
});
test('15-puzzle completion and restore derive state, history and elapsed safely',()=>{
  const board=solvedFifteen();[board[14],board[15]]=[board[15],board[14]];
  const state=restoreNumberGame('fifteen',{board,moves:10,elapsed:30,completed:true,history:[{board:solvedFifteen(),moves:0},{board:[4]}]});
  assert.equal(state.completed,false);assert.equal(state.history.length,1);
  const next=moveFifteen(state,15).state;assert.equal(next.completed,true);assert.equal(next.moves,11);
  assert.equal(moveFifteen(next,14).changed,false);
  const restored=restoreNumberGame('fifteen',JSON.parse(JSON.stringify(next)));
  assert.deepEqual(restored.board,next.board);assert.equal(restored.elapsed,30);assert.equal(restored.completed,true);
});
