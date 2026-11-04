import test from 'node:test';
import assert from 'node:assert/strict';
import {SHAPES,shapeCells,canPlace,clearCompleted,dealPieces,hasAnyMove,createWood,placeWood,undoWood,restoreWood,serializeWood} from '../games/wood-engine.mjs';
const blank=()=>Array(81).fill(0);
const fixture=(board=blank(),tray=['dot','dot','dot'])=>({...createWood(()=>0),board,tray});

test('all shapes fit their stated bounds and initial tray has exactly three movable pieces',()=>{
  for(const shape of Object.values(SHAPES)){assert.equal(new Set(shape.cells.map(c=>c.join(','))).size,shape.cells.length);assert(shapeCells(shape.id,0));assert(canPlace(blank(),shape.id,0));}
  const state=createWood(()=>.99);assert.equal(state.tray.length,3);assert.equal(state.score,0);assert(hasAnyMove(state.board,state.tray));
});
test('placement checks edges, overlaps, selected tray and uses no randomness on invalid input',()=>{
  const board=blank();board[0]=1;
  assert.equal(canPlace(board,'dot',0),false);assert.equal(canPlace(board,'domino-h',8),false);assert.equal(canPlace(board,'line3-v',72),false);
  assert.equal(shapeCells('unknown',0),null);assert.equal(shapeCells('dot',-1),null);
  const state=fixture(board,['domino-h',null,'dot']);let called=0;const random=()=>{called++;return 0;};
  for(const [piece,anchor] of [[0,8],[1,10],[2,0],[8,10],[0,80]])assert.equal(placeWood(state,piece,anchor,random).changed,false);
  assert.equal(called,0);assert.equal(state.moves,0);
});
test('a complete row, column and 3×3 box each clear independently',()=>{
  for(const indices of [Array.from({length:9},(_,i)=>i),Array.from({length:9},(_,i)=>i*9),[0,1,2,9,10,11,18,19,20]]){
    const board=blank();indices.forEach(i=>board[i]=1);const cleared=clearCompleted(board);
    assert.equal(cleared.unitCount,1);assert.equal(cleared.cleared.length,9);assert(cleared.board.every(n=>n===0));assert.equal(board.filter(Boolean).length,9);
  }
});
test('simultaneous row/column/box clears take the union and never double-count overlapping cells',()=>{
  const board=blank();const indices=new Set([...Array.from({length:9},(_,i)=>i),...Array.from({length:9},(_,i)=>i*9),0,1,2,9,10,11,18,19,20]);indices.forEach(i=>board[i]=1);board[0]=0;
  const state=fixture(board);const result=placeWood(state,0,0);
  assert(result.changed);assert.equal(result.state.lastUnits,3);assert.equal(result.state.lastCleared.length,indices.size);
  assert.equal(result.gained,1+indices.size+30);assert.equal(result.state.board.filter(Boolean).length,0);assert.equal(result.state.clearedTotal,3);
});
test('tray pieces are consumed independently and only the third placement deals a fresh tray',()=>{
  let calls=0;const random=()=>{calls++;return .2;};let state=fixture();
  state=placeWood(state,0,0,random).state;assert.deepEqual(state.tray,[null,'dot','dot']);assert.equal(calls,0);
  state=placeWood(state,1,4,random).state;assert.deepEqual(state.tray,[null,null,'dot']);assert.equal(calls,0);
  state=placeWood(state,2,8,random).state;assert(state.tray.every(Boolean));assert.equal(calls,3);assert.equal(state.moves,3);
});
test('Undo restores placement, score, cleared units and the exact tray before a new deal',()=>{
  let state=fixture();state=placeWood(state,0,0).state;state=placeWood(state,1,4).state;
  const before=serializeWood(state),after=placeWood(state,2,8,()=>.99).state;
  assert.notDeepEqual(after.tray,state.tray);const undone=undoWood(after);
  assert(undone.changed);assert.deepEqual(serializeWood(undone.state),before);assert.equal(undoWood(fixture()).changed,false);
});
test('a fresh deal guarantees at least one fitting piece whenever any shape fits',()=>{
  const board=Array(81).fill(1);board[40]=0;
  const tray=dealPieces(board,()=>.999);assert(tray.includes('dot'));assert(hasAnyMove(board,tray));
  assert.equal(hasAnyMove(Array(81).fill(1),tray),false);
});
test('game ends when no remaining hand piece fits, and Undo reopens the move',()=>{
  const board=Array(81).fill(1);for(let r=0;r<9;r++)for(let c=0;c<9;c++)if((r+c)%2===0)board[r*9+c]=0;
  const state=fixture(board,['dot','square2','square2']);assert(hasAnyMove(board,state.tray));
  const result=placeWood(state,0,0);assert(result.changed);assert.equal(result.state.over,true);assert.equal(placeWood(result.state,1,1).changed,false);
  assert.equal(undoWood(result.state).state.over,false);
});
test('saved games round-trip without shared arrays, derive end state, and reject malformed data',()=>{
  const state=placeWood(fixture(),0,0).state,saved=serializeWood(state),restored=restoreWood({...saved,over:true});
  assert.equal(restored.over,false);assert.deepEqual(serializeWood(restored),saved);restored.board[1]=1;assert.equal(saved.board[1],0);
  assert.equal(restoreWood(null),null);assert.equal(restoreWood({...saved,board:[0]}),null);assert.equal(restoreWood({...saved,tray:['bad','dot',null]}),null);assert.equal(restoreWood({...saved,tray:[null,null,null]}),null);
  assert.equal(restoreWood({...saved,score:-10}).score,0);
});
