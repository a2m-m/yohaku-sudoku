import {SHAPES,createWood,placeWood,undoWood,restoreWood,serializeWood,canPlace,shapeCells} from './wood-engine.mjs';

const KEY='yohaku-games:v1:wood';
const BEST=`${KEY}:best`;
const memory=new Map();
function read(key,fallback){if(memory.has(key))return memory.get(key);try{const text=localStorage.getItem(key);return text===null?fallback:JSON.parse(text);}catch{return fallback;}}
const shapeMarkup=(id,extra='')=>{
  const shape=SHAPES[id],filled=new Set(shape.cells.map(([r,c])=>r*shape.width+c));
  return `<span class="wdp-piece-grid ${extra}" style="--wdp-shape-cols:${shape.width};--wdp-shape-rows:${shape.height}">${Array.from({length:shape.width*shape.height},(_,i)=>`<i class="${filled.has(i)?'wdp-bit':''}"></i>`).join('')}</span>`;
};
const undoIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3"/></svg>';

export function mount(container,{notify=()=>{},onUpdate=()=>{}}={}){
  let state=restoreWood(read(KEY,null))||createWood();
  let best=read(BEST,0);if(!Number.isSafeInteger(best)||best<0)best=0;best=Math.max(best,state.score);
  let selected=-1,anchor=null,focus=0,drag=null,disposed=false,storageOK=true,suppressTrayClickUntil=0;
  container.innerHTML=`<section class="wdp-game" aria-label="ウッドパズルのゲーム盤">
    <div class="wdp-toolbar"><div class="wdp-metrics"><div><span>スコア</span><strong data-wood="score">0</strong></div><div><span>ベスト</span><strong data-wood="best">0</strong></div></div><button class="wdp-new" data-wood="new">新しく始める <span aria-hidden="true">↻</span></button></div>
    <div class="wdp-score-gain" data-wood="gain" aria-live="polite"></div>
    <div class="wdp-board" data-wood="board" role="grid" aria-label="9行9列のウッドパズル盤面" aria-rowcount="9" aria-colcount="9"></div>
    <div class="wdp-board-caption"><span data-wood="occupied">0 / 81</span><span data-wood="clears">消した列・区画 0</span></div>
    <p class="wdp-message" data-wood="message" role="status" aria-live="polite">下のブロックを選びましょう。</p>
    <div class="wdp-tray" data-wood="tray" aria-label="手持ちの3つのブロック"></div>
    <div class="wdp-controls"><button data-wood="undo">${undoIcon}<span>元に戻す</span></button><p>ブロックを選ぶ → 左上を置くマスをタップ<br>ドラッグでも置けます。回転・制限時間なし。</p></div>
    <div class="wdp-result" data-wood="result" hidden><span aria-hidden="true">◇</span><h2>よく、詰め込みました。</h2><p>手持ちのブロックを置ける場所がなくなりました。</p><strong data-wood="final-score"></strong><button data-wood="new">もう一度、遊ぶ →</button><small>「元に戻す」で一手前からやり直すこともできます。</small></div>
    <p class="wdp-tip">縦・横・3×3の区画を埋めると、まとめて消えます。</p><p class="wdp-save" data-wood="save">この端末に自動保存</p>
  </section>`;
  const find=name=>container.querySelector(`[data-wood="${name}"]`),board=find('board'),tray=find('tray');
  const cells=Array.from({length:81},(_,i)=>{const cell=document.createElement('button');cell.type='button';cell.className='wdp-cell';cell.dataset.cell=i;cell.setAttribute('role','gridcell');cell.setAttribute('aria-rowindex',Math.floor(i/9)+1);cell.setAttribute('aria-colindex',i%9+1);board.append(cell);return cell;});
  const ghost=document.createElement('div');ghost.className='wdp-drag-ghost';ghost.hidden=true;ghost.setAttribute('aria-hidden','true');document.body.append(ghost);
  function save(){
    const data=serializeWood(state);memory.set(KEY,data);memory.set(BEST,best);
    try{localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem(BEST,JSON.stringify(best));}
    catch{if(storageOK)notify('端末に保存できませんでした。ゲーム室を閉じると進捗が失われる場合があります。');storageOK=false;}
    find('save').textContent=storageOK?'この端末に自動保存':'この画面内に保存中';
    onUpdate({id:'wood',started:state.moves>0,completed:state.over,score:state.score,moves:state.moves});
  }
  const selectedId=()=>state.tray[selected]||null;
  function previewCells(){
    const shape=SHAPES[selectedId()];if(!shape||anchor===null)return [];
    const row=Math.floor(anchor/9),col=anchor%9;
    return shape.cells.map(([r,c])=>[row+r,col+c]).filter(([r,c])=>r>=0&&r<9&&c>=0&&c<9).map(([r,c])=>r*9+c);
  }
  function renderBoard(){
    const id=selectedId(),preview=previewCells(),valid=anchor!==null&&id&&canPlace(state.board,id,anchor);
    cells.forEach((cell,i)=>{
      cell.className=['wdp-cell',state.board[i]?'wdp-filled':'',preview.includes(i)?valid?'wdp-preview-valid':'wdp-preview-invalid':'',state.lastCleared.includes(i)?'wdp-cleared':'',state.lastPlaced.includes(i)&&state.board[i]?'wdp-placed':''].filter(Boolean).join(' ');
      cell.tabIndex=i===focus?0:-1;cell.disabled=state.over;
      const legal=id&&canPlace(state.board,id,i);
      cell.setAttribute('aria-label',`${Math.floor(i/9)+1}行${i%9+1}列、${state.board[i]?'ブロックあり':legal?'ここを左上として配置できます':'空きマス'}`);
    });
    find('message').textContent=state.over?'「元に戻す」か、新しいゲームでもう一度。':id?`${SHAPES[id].label}を選択中。ブロックの左上を置くマスをタップ。`:'下のブロックを選びましょう。';
    tray.querySelectorAll('[data-piece]').forEach(button=>{button.classList.toggle('wdp-selected',Number(button.dataset.piece)===selected);button.setAttribute('aria-pressed',String(Number(button.dataset.piece)===selected));});
  }
  function render(){
    find('score').textContent=state.score.toLocaleString('ja-JP');find('best').textContent=best.toLocaleString('ja-JP');
    find('gain').textContent=state.gain?`+${state.gain}${state.lastUnits?` · ${state.lastUnits}列・区画クリア` : ''}`:'';
    find('gain').classList.toggle('wdp-combo',state.lastUnits>1);
    find('occupied').textContent=`${state.board.filter(Boolean).length} / 81`;
    find('clears').textContent=`消した列・区画 ${state.clearedTotal}`;
    tray.innerHTML=state.tray.map((id,i)=>id?`<button class="wdp-tray-piece" data-piece="${i}" aria-label="ブロック${i+1}、${SHAPES[id].label}、${SHAPES[id].cells.length}マス" aria-pressed="false" ${state.over?'disabled':''}>${shapeMarkup(id)}<small>${SHAPES[id].label}</small></button>`:'<div class="wdp-tray-used" aria-label="配置済み"><span aria-hidden="true">✓</span><small>配置済み</small></div>').join('');
    find('undo').disabled=!state.history.length;find('result').hidden=!state.over;
    find('final-score').textContent=`${state.score.toLocaleString('ja-JP')} points`;
    renderBoard();
  }
  function setSelection(index){if(!state.tray[index]||state.over)return;selected=index;anchor=null;renderBoard();}
  function apply(result){
    if(!result.changed)return;
    state=result.state;best=Math.max(best,state.score);selected=-1;anchor=null;save();render();
    if(state.lastUnits)notify(`${state.lastUnits}列・区画をまとめてクリア！ +${state.gain}`);
  }
  function place(index){
    if(selected<0){notify('先に、下のブロックを選んでください');return;}
    const result=placeWood(state,selected,index);
    if(!result.changed){notify('ここには置けません。空きマスと盤面の端を確認してください');return;}
    apply(result);
  }
  function endDrag(){
    if(drag?.button?.hasPointerCapture?.(drag.id))try{drag.button.releasePointerCapture(drag.id);}catch{}
    drag=null;ghost.hidden=true;
  }
  function newGame(){
    if(state.moves>0&&!state.over&&!confirm('今の途中経過をリセットして、新しく始めますか？'))return;
    endDrag();state=createWood();selected=-1;anchor=null;save();render();
  }
  function click(event){
    const button=event.target.closest('button');if(!button||!container.contains(button)||disposed)return;
    if(button.dataset.piece!==undefined){if(performance.now()>=suppressTrayClickUntil)setSelection(Number(button.dataset.piece));}
    else if(button.dataset.cell!==undefined){focus=Number(button.dataset.cell);place(focus);}
    else if(button.dataset.wood==='undo'){endDrag();apply(undoWood(state));}
    else if(button.dataset.wood==='new')newGame();
  }
  function boardPoint(x,y,offsetCol=0,offsetRow=0,lift=0){
    const first=cells[0].getBoundingClientRect(),second=cells[1].getBoundingClientRect(),step=second.left-first.left;
    const col=Math.floor((x-first.left)/step)-offsetCol,row=Math.floor((y-lift-first.top)/step)-offsetRow;
    return row<0||row>8||col<0||col>8?null:row*9+col;
  }
  function pointerdown(event){
    const button=event.target.closest('[data-piece]');
    if(!button||!event.isPrimary||event.button!==0||state.over)return;
    const index=Number(button.dataset.piece),id=state.tray[index];if(!id)return;
    setSelection(index);
    const grid=button.querySelector('.wdp-piece-grid'),rect=grid.getBoundingClientRect(),shape=SHAPES[id];
    const offsetCol=Math.max(0,Math.min(shape.width-1,Math.floor((event.clientX-rect.left)/(rect.width/shape.width))));
    const offsetRow=Math.max(0,Math.min(shape.height-1,Math.floor((event.clientY-rect.top)/(rect.height/shape.height))));
    drag={id:event.pointerId,index,button,startX:event.clientX,startY:event.clientY,offsetCol,offsetRow,moved:false,lift:event.pointerType==='touch'?40:0};
    button.setPointerCapture(event.pointerId);
  }
  function pointermove(event){
    if(drag&&event.pointerId!==drag.id)return;
    if(drag&&event.pointerId===drag.id){
      if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<7)return;
      drag.moved=true;
      const shape=SHAPES[state.tray[drag.index]],first=cells[0].getBoundingClientRect(),second=cells[1].getBoundingClientRect(),step=second.left-first.left;
      anchor=boardPoint(event.clientX,event.clientY,drag.offsetCol,drag.offsetRow,drag.lift);
      ghost.innerHTML=shapeMarkup(shape.id);ghost.style.setProperty('--wdp-drag-unit',`${step}px`);
      ghost.style.left=`${event.clientX-(drag.offsetCol+.5)*step}px`;ghost.style.top=`${event.clientY-(drag.offsetRow+.5)*step-drag.lift}px`;
      ghost.classList.toggle('wdp-drag-invalid',anchor===null||!canPlace(state.board,shape.id,anchor));ghost.hidden=false;renderBoard();
    }else if(selectedId()){
      const cell=event.target.closest('[data-cell]');const next=cell?Number(cell.dataset.cell):null;
      if(next!==anchor){anchor=next;renderBoard();}
    }
  }
  function pointerup(event){
    if(!drag||event.pointerId!==drag.id)return;
    const moved=drag.moved,index=anchor;
    if(moved)suppressTrayClickUntil=performance.now()+400;
    endDrag();
    if(moved){if(index!==null){focus=index;place(index);}else{anchor=null;renderBoard();}}
  }
  function pointercancel(event){if(drag&&event.pointerId!==drag.id)return;endDrag();anchor=null;renderBoard();}
  function keydown(event){
    if(!event.target.closest('[data-cell]')||state.over)return;
    const i=Number(event.target.dataset.cell),r=Math.floor(i/9),c=i%9;
    const next=event.key==='ArrowLeft'?r*9+(c+8)%9:event.key==='ArrowRight'?r*9+(c+1)%9:event.key==='ArrowUp'?(i+72)%81:event.key==='ArrowDown'?(i+9)%81:null;
    if(next!==null){event.preventDefault();focus=next;anchor=next;renderBoard();cells[next].focus({preventScroll:true});}
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();apply(undoWood(state));}
  }
  function visibility(){if(document.hidden){endDrag();save();}}
  container.addEventListener('click',click);container.addEventListener('pointerdown',pointerdown);container.addEventListener('pointermove',pointermove);container.addEventListener('pointerup',pointerup);container.addEventListener('pointercancel',pointercancel);board.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',visibility);
  save();render();
  return ()=>{if(disposed)return;endDrag();save();disposed=true;ghost.remove();container.removeEventListener('click',click);container.removeEventListener('pointerdown',pointerdown);container.removeEventListener('pointermove',pointermove);container.removeEventListener('pointerup',pointerup);container.removeEventListener('pointercancel',pointercancel);board.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',visibility);};
}
