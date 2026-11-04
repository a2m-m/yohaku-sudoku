import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,flipsFor,legalMoves,playMove,undoMove,scores,chooseMove,restoreGame,serializeGame} from '../games/reversi-engine.mjs';

test('standard opening has black first and exactly four legal moves',()=>{
  const game=createGame();
  assert.deepEqual(scores(game.board),{black:2,white:2,empty:60});
  assert.equal(game.turn,1);assert.equal(game.board[27],-1);assert.equal(game.board[28],1);
  assert.deepEqual(legalMoves(game.board,1),[19,26,37,44]);
  assert.equal(playMove(game,0).changed,false);assert.equal(playMove(game,27).changed,false);
});
test('every direction is bracketed correctly and all eight may flip at once',()=>{
  const board=Array(64).fill(0),center=27;
  for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){
    board[(3+dr)*8+3+dc]=-1;board[(3+2*dr)*8+3+2*dc]=1;
  }
  assert.equal(flipsFor(board,center,1).length,8);
  const state={...createGame(),board};const next=playMove(state,center).state;
  assert.equal(scores(next.board).white,0);assert.equal(board[center],0);
  assert.equal(flipsFor(board,center,-1).length,0);
});
test('rays never wrap rows, cross empty gaps, or flip without a friendly endpoint',()=>{
  const board=Array(64).fill(0);board[7]=-1;board[8]=1;
  assert.deepEqual(flipsFor(board,6,1),[]);
  board[7]=0;board[6]=-1;board[5]=1;
  assert.deepEqual(flipsFor(board,8,1),[]);
  const opening=createGame();assert.deepEqual(flipsFor(opening.board,19,1),[27]);
});
test('legal moves are immutable and Undo restores the previous turn and flips',()=>{
  const original=createGame();original.elapsed=21;
  const next=playMove(original,19).state;
  assert.deepEqual(scores(next.board),{black:4,white:1,empty:59});
  assert.equal(next.turn,-1);assert.equal(next.moves,1);assert.equal(next.lastMove,19);
  assert.equal(original.board[19],0);assert.equal(original.history.length,0);
  const restored=undoMove({...next,elapsed:30}).state;
  assert.deepEqual(restored.board,original.board);assert.equal(restored.turn,1);assert.equal(restored.moves,0);assert.equal(restored.elapsed,30);
  assert.equal(undoMove(restored).changed,false);
});
test('single automatic pass keeps the current side moving when opponent has no move',()=>{
  const board=Array(64).fill(1);board[0]=0;board[1]=-1;board[63]=0;board[62]=-1;
  const next=playMove({...createGame(),board},0).state;
  assert.equal(next.status,'playing');assert.equal(next.turn,1);assert.equal(next.passed,-1);
  assert.deepEqual(legalMoves(next.board,1),[63]);
});
test('both sides without a move finish the game even with empty cells',()=>{
  const board=Array(64).fill(0);board[0]=1;board[1]=-1;
  const next=playMove({...createGame(),board},2).state;
  assert.equal(next.status,'finished');assert.equal(next.winner,1);assert.equal(scores(next.board).empty,61);
  assert.equal(playMove(next,3).changed,false);
});
test('full board results count both colors and a tie has winner zero',()=>{
  const board=Array(64).fill(-1),rays=new Set([60,59,58,57,56,61,62,63,52,44,36,28,20,12,4,51,42,33,24,53,46,39]);
  let black=0;for(let i=0;i<64&&black<29;i++)if(!rays.has(i)){board[i]=1;black++;}
  board[62]=1;board[60]=0;
  const next=playMove({...createGame(),board,turn:1},60).state;
  assert.equal(next.status,'finished');assert.equal(next.winner,0);assert.deepEqual(scores(next.board),{black:32,white:32,empty:0});
});
test('restoration replays legal history, derives completion, and rejects corrupted saves',()=>{
  let game=createGame({mode:'local',difficulty:'hard'});
  for(let i=0;i<12;i++)game=playMove(game,legalMoves(game.board,game.turn)[0]).state;
  game.elapsed=53;
  const saved=serializeGame(game),restored=restoreGame(saved);
  assert.deepEqual(restored,game);saved.board[0]=99;assert.equal(restoreGame(saved),null);
  const fake=serializeGame(game);fake.status='finished';fake.winner=1;
  assert.equal(restoreGame(fake).status,'playing');
  fake.history[2].board[10]=1;assert.equal(restoreGame(fake),null);
  assert.equal(restoreGame({...serializeGame(game),turn:-game.turn}),null);
  assert.equal(restoreGame({...serializeGame(game),moves:100000}),null);
  assert.equal(restoreGame(null),null);
});
test('complete games retain valid histories, correct counts, and replay through passes',()=>{
  let seed=83;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  for(let round=0;round<12;round++){
    let game=createGame();
    while(game.status==='playing'){
      const choices=legalMoves(game.board,game.turn);assert.ok(choices.length);
      const before=game.moves;game=playMove(game,choices[Math.floor(random()*choices.length)]).state;
      assert.equal(game.moves,before+1);assert.equal(scores(game.board).empty,60-game.moves);
    }
    assert.equal(legalMoves(game.board,1).length,0);assert.equal(legalMoves(game.board,-1).length,0);
    assert.equal(game.winner,Math.sign(scores(game.board).black-scores(game.board).white));
    assert.deepEqual(restoreGame(serializeGame(game)),game);
  }
});
test('AI chooses only legal moves, never mutates positions, and respects node budgets',()=>{
  let game=createGame(),seed=13;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  for(let i=0;i<100;i++){
    if(game.status==='finished')game=createGame();
    const original=game.board.slice(),legal=legalMoves(game.board,game.turn),stats={};
    const difficulty=i%10===0?'hard':i%3===0?'normal':'easy';
    const move=chooseMove(game.board,game.turn,difficulty,{random,timeLimit:8,nodeLimit:80,stats});
    assert.ok(legal.includes(move));assert.deepEqual(game.board,original);
    if(difficulty!=='easy')assert.ok(stats.nodes<=81);
    game=playMove(game,move).state;
  }
  assert.equal(chooseMove(Array(64).fill(1),-1),null);
});
test('AI values an immediately available corner and survives a one-node budget',()=>{
  const board=createGame().board;board[0]=0;board[1]=-1;board[2]=1;
  assert.equal(chooseMove(board,1,'hard',{timeLimit:50,nodeLimit:1}),0);
});
