import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, validateState, restoreState, serializeState, sourceCards, canMove, moveCapacity, moveCard, drawCard, undoMove, restartDeal, legalMoves, autoFoundation, rank, suit, isRed } from '../games/cards-engine.mjs';

const id = (s,r) => s * 13 + r - 1;
function rng(seed=17) { return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }
function fixture(variant, piles, { cells=[null,null,null,null], foundations=[[],[],[],[]], waste=[] }={}) {
  const state=createState(variant,rng());
  state.tableau=Array.from({length:variant==='freecell'?8:7},(_,i)=>(piles[i]||[]).map(value=>typeof value==='number'?{id:value,up:true}:value));
  state.cells=[...cells];state.foundations=foundations.map(p=>[...p]);state.waste=[...waste];
  const used=new Set([...state.tableau.flat().map(c=>c.id),...cells.filter(c=>c!==null),...foundations.flat(),...waste]);
  const rest=Array.from({length:52},(_,i)=>i).filter(i=>!used.has(i));
  if(variant==='solitaire')state.stock=rest;
  else{state.stock=[];state.tableau[7].unshift(...rest.map(value=>({id:value,up:true})));}
  return state;
}

test('card identities, colors, and shuffled complete initial deals',()=>{
  assert.equal(rank(0),1);assert.equal(suit(51),3);assert.equal(isRed(13),true);assert.equal(isRed(26),false);
  for(const variant of ['solitaire','freecell'])for(let seed=1;seed<=40;seed++){
    const state=createState(variant,rng(seed));assert.equal(validateState(state),true);
    if(variant==='solitaire'){assert.equal(state.stock.length,24);assert.deepEqual(state.tableau.map(p=>p.length),[1,2,3,4,5,6,7]);assert.equal(state.tableau.flat().filter(c=>c.up).length,7);}
    else assert.deepEqual(state.tableau.map(p=>p.length),[7,7,7,7,6,6,6,6]);
  }
});

test('Klondike stock draws one at a time and recycles in the same order',()=>{
  let state=createState('solitaire',rng());const original=[...state.stock];const initial=serializeState(state);
  for(let i=0;i<24;i++){const before=state;state=drawCard(state);assert.equal(state.waste.at(-1),original.at(-1-i));assert.equal(before.stock.length,24-i);assert.equal(validateState(state),true);}
  state=drawCard(state);assert.deepEqual(state.stock,original);assert.equal(state.waste.length,0);
  state=drawCard(state);assert.equal(state.waste.at(-1),original.at(-1));
  assert.deepEqual(restartDeal(state).tableau,initial.tableau);assert.deepEqual(restartDeal(state).stock,initial.stock);
});

test('tableau builds down in alternating colors and empty Klondike columns accept Kings',()=>{
  const state=fixture('solitaire',[[id(0,7)],[id(1,6)],[id(2,6)],[id(1,13)],[]]);
  assert.equal(canMove(state,{type:'tableau',index:1,offset:0},{type:'tableau',index:0}),true);
  assert.equal(canMove(state,{type:'tableau',index:2,offset:0},{type:'tableau',index:0}),false);
  assert.equal(canMove(state,{type:'tableau',index:1,offset:0},{type:'tableau',index:4}),false);
  assert.equal(canMove(state,{type:'tableau',index:3,offset:0},{type:'tableau',index:4}),true);
  assert.equal(moveCard(state,{type:'tableau',index:2,offset:0},{type:'tableau',index:0}),state);
});

test('moving a valid face-up sequence exposes the next hidden card without mutating the past',()=>{
  const state=fixture('solitaire',[[{id:id(0,1),up:false},{id:id(1,6),up:true},{id:id(0,5),up:true}],[id(2,7)]]);
  const next=moveCard(state,{type:'tableau',index:0,offset:1},{type:'tableau',index:1});
  assert.notEqual(next,state);assert.equal(next.tableau[0][0].up,true);assert.equal(state.tableau[0][0].up,false);
  assert.deepEqual(next.tableau[1].map(c=>c.id),[id(2,7),id(1,6),id(0,5)]);assert.equal(validateState(next),true);
  assert.deepEqual(undoMove(next).tableau,state.tableau);
  assert.deepEqual(sourceCards(state,{type:'tableau',index:0,offset:0}),[]);
});

test('foundations accept only the next same-suit card and only one card',()=>{
  const state=fixture('solitaire',[[id(0,1)],[id(1,1)],[id(0,2)],[id(0,3),id(1,2)]]);
  assert.equal(canMove(state,{type:'tableau',index:0,offset:0},{type:'foundation',index:0}),true);
  assert.equal(canMove(state,{type:'tableau',index:1,offset:0},{type:'foundation',index:0}),false);
  assert.equal(canMove(state,{type:'tableau',index:2,offset:0},{type:'foundation',index:0}),false);
  assert.equal(canMove(state,{type:'tableau',index:3,offset:0},{type:'foundation',index:0}),false);
  const next=moveCard(state,{type:'tableau',index:0,offset:0},{type:'foundation',index:0});
  assert.equal(canMove(next,{type:'tableau',index:2,offset:0},{type:'foundation',index:0}),true);assert.equal(validateState(next),true);
});

test('FreeCell temporary slots hold one card and empty columns accept any rank',()=>{
  const state=fixture('freecell',[[id(0,7),id(1,6)],[],[id(2,4)]]);
  assert.equal(canMove(state,{type:'tableau',index:0,offset:0},{type:'cell',index:0}),false);
  assert.equal(canMove(state,{type:'tableau',index:0,offset:1},{type:'cell',index:0}),true);
  const next=moveCard(state,{type:'tableau',index:0,offset:1},{type:'cell',index:0});
  assert.equal(canMove(next,{type:'tableau',index:2,offset:0},{type:'cell',index:0}),false);
  assert.equal(canMove(next,{type:'cell',index:0},{type:'tableau',index:1}),true);assert.equal(validateState(next),true);
});

test('FreeCell supermove capacity excludes the destination empty column',()=>{
  const state=fixture('freecell',[[id(0,7),id(1,6),id(2,5),id(3,4)],[],[id(1,8)],[id(0,10)],[id(0,11)],[id(0,12)],[id(0,13)]],{cells:[id(2,1),id(2,2),id(2,3),null]});
  assert.equal(moveCapacity(state,1),2);assert.equal(moveCapacity(state,2),4);
  assert.equal(canMove(state,{type:'tableau',index:0,offset:0},{type:'tableau',index:1}),false);
  assert.equal(canMove(state,{type:'tableau',index:0,offset:0},{type:'tableau',index:2}),true);
  assert.equal(canMove(state,{type:'tableau',index:0,offset:2},{type:'tableau',index:1}),true);
});

test('safe auto foundation is reversible in one press and all 52 cards are conserved',()=>{
  const state=fixture('solitaire',[[id(0,1)],[id(1,1)],[id(2,1)],[id(3,1)],[id(0,2)],[id(1,2)]]);
  const next=autoFoundation(state);assert.equal(next.foundations.flat().length,6);assert.equal(validateState(next),true);
  const previous=undoMove(next);assert.deepEqual(previous.tableau,state.tableau);assert.deepEqual(previous.foundations,state.foundations);
});

test('win detection, validated restoration, invalid duplicates and fake win flags',()=>{
  const foundations=Array.from({length:4},(_,s)=>Array.from({length:s===3?12:13},(_,r)=>id(s,r+1)));
  const state=fixture('freecell',[[id(3,13)]],{foundations});
  const next=moveCard(state,{type:'tableau',index:0,offset:0},{type:'foundation',index:3});assert.equal(next.won,true);assert.equal(validateState(next),true);
  const saved=serializeState(next);assert.equal(restoreState(saved,'freecell').won,true);assert.equal(restoreState(saved,'solitaire'),null);
  saved.tableau[0].push({id:51,up:true});assert.equal(restoreState(saved,'freecell'),null);
  const initial=createState('solitaire',rng());initial.won=true;assert.equal(restoreState(initial,'solitaire').won,false);
});

test('long legal sequences preserve identities, serialize safely, and undo elapsed time correctly',()=>{
  for(const variant of ['solitaire','freecell']){
    let state=createState(variant,rng(734)),random=rng(111);
    for(let i=0;i<250;i++){
      const moves=legalMoves(state);
      const next=moves.length?moveCard(state,...Object.values(moves[Math.floor(random()*moves.length)])):drawCard(state);
      if(next===state)break;
      state=next;state.elapsed=i+1;
      assert.equal(validateState(state),true,`${variant} move ${i}`);
      if(i%11===0){const restored=restoreState(JSON.parse(JSON.stringify(serializeState(state))),variant);assert.deepEqual(restored.tableau,state.tableau);assert.equal(restored.moves,state.moves);assert.equal(restored.elapsed,state.elapsed);}
    }
    assert.ok(state.history.length<=60);
    const undone=undoMove(state);assert.equal(undone.elapsed,state.elapsed);assert.equal(validateState(undone),true);
  }
});
