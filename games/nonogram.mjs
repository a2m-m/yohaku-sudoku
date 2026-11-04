import {PUZZLES} from './nonogram-puzzles.mjs';
import {cluesFor,createGame,paintCells,undo,hint,wrongCells,lineMatches,serializeGame,solutionFor} from './nonogram-engine.mjs';

const PREFIX='yohaku-games:v1:nonogram:';
const memory=new Map();
const read=(key,fallback=null)=>{if(memory.has(key))return memory.get(key);try{const text=localStorage.getItem(key);return text===null?fallback:JSON.parse(text);}catch{return fallback;}};
const time=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
const svg=path=>`<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
export function mount(container,{notify=()=>{},onUpdate=()=>{}}={}){
  let puzzle=PUZZLES.find(p=>p.id===read(PREFIX+'current'))||PUZZLES[0];
  let game=createGame(puzzle,read(PREFIX+puzzle.id)),clues=cluesFor(puzzle.rows),mode=1,focused=0,errors=[],revealed=-1,stroke=null,disposed=false,storageOK=true,filter=0,statusFilter='all',libraryPage=0,zoomed=false,last=performance.now(),fraction=0,lastSaved=-1;
  container.innerHTML=`<section class="ngm-game" aria-label="お絵描きロジックのゲーム"><div class="ngm-toolbar"><button class="ngm-puzzle-select" data-ngm="library">No. <span data-ngm="number"></span><small data-ngm="size"></small><span aria-hidden="true">⌄</span></button><span class="ngm-time" data-ngm="time">00:00</span></div><div class="ngm-view-controls" data-ngm="view-controls" hidden><span>大きな盤面も、ひとマスずつ。</span><button data-ngm="zoom" aria-pressed="false">拡大して入力</button></div><div class="ngm-board-scroll" data-ngm="board-scroll"><div class="ngm-board" data-ngm="board" role="grid" aria-label="お絵描きロジックの盤面"></div></div><div class="ngm-pan" data-ngm="pan-controls" hidden><span>左右に移動</span><input data-ngm="pan" type="range" min="0" max="100" value="0" aria-label="盤面を左右に移動"></div><div class="ngm-caption"><span data-ngm="status">数字を頼りに、塗るマスを見つけよう。</span><span data-ngm="progress"></span></div><div class="ngm-modes" aria-label="入力モード"><button data-mode="1" aria-pressed="true"><span class="ngm-mode-square" aria-hidden="true"></span>塗る</button><button data-mode="-1" aria-pressed="false"><span aria-hidden="true">×</span>×を付ける</button><button data-mode="0" aria-pressed="false">${svg('<path d="m9 19-6-6 9-9 9 9-6 6Zm-3-9 9 9M9 19h12"/>')}消す</button></div><div class="ngm-actions"><button data-ngm="undo">${svg('<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3"/>')}<span>元に戻す</span></button><button data-ngm="hint">${svg('<path d="M9 18v-2a6 6 0 1 1 6 0v2Zm0 3h6"/>')}<span>ヒント</span></button><button data-ngm="check">${svg('<path d="m5 12 4 4L19 6"/>')}<span>確認</span></button></div><div class="ngm-completion" data-ngm="completion" hidden><span class="ngm-clear-label">PICTURE COMPLETE</span><h2 data-ngm="picture-title"></h2><p data-ngm="clear-stats"></p><button data-ngm="next">次の絵を描く →</button></div><div class="ngm-bottom"><span data-ngm="save">この端末に自動保存</span><button data-ngm="reset">この問題を最初から</button></div><p class="ngm-tip">続けてなぞると、同じ行・列をまとめて入力。<br>空白すべてに×を付けなくても完成できます。</p></section><dialog class="ngm-library"><div class="ngm-library-header"><div><span>YOUR PICTURE BOOK</span><h2>お絵描きの問題集</h2></div><button data-ngm="close-library" aria-label="問題集を閉じる">×</button></div><p class="ngm-library-description">全${PUZZLES.length}問。完成すると、どんな絵かがわかります。</p><div class="ngm-library-filter" aria-label="盤面サイズで絞り込む"><button data-size="0">すべて</button><button data-size="5">5 × 5</button><button data-size="10">10 × 10</button><button data-size="15">15 × 15</button></div><div class="ngm-library-state" aria-label="進み具合で絞り込む"><button data-progress="all">すべて</button><button data-progress="unplayed">未クリア</button><button data-progress="started">途中</button><button data-progress="completed">クリア</button></div><div class="ngm-puzzle-grid" data-ngm="puzzles"></div><p class="ngm-library-empty" data-ngm="empty" hidden>この条件に合う問題はまだありません。</p><nav class="ngm-library-pages" aria-label="問題集のページ"><button data-ngm="page-back">← 前へ</button><span data-ngm="page-range" aria-live="polite"></span><button data-ngm="page-next">次へ →</button></nav><p class="ngm-library-progress" data-ngm="book-progress"></p></dialog>`;
  const find=name=>container.querySelector(`[data-ngm="${name}"]`),board=find('board'),library=container.querySelector('.ngm-library');
  let book={};
  const pageSize=24;
  function progressFor(p){
    if(book[p.id]&&typeof book[p.id].completed==='boolean'&&typeof book[p.id].started==='boolean')return book[p.id];
    const saved=read(PREFIX+p.id),cells=saved?.puzzleId===p.id&&Array.isArray(saved.cells)&&saved.cells.length===p.size*p.size&&saved.cells.every(v=>[-1,0,1].includes(v))?saved.cells:null;
    const completed=!!cells&&cells.every((v,i)=>(v===1?1:0)===Number(p.rows[Math.floor(i/p.size)][i%p.size]));
    return book[p.id]={completed,started:!!cells&&cells.some(v=>v!==0)};
  }
  function libraryPuzzles(){return PUZZLES.filter(p=>{const s=progressFor(p);return (!filter||p.size===filter)&&(statusFilter==='all'||statusFilter==='unplayed'&&!s.completed||statusFilter==='started'&&s.started&&!s.completed||statusFilter==='completed'&&s.completed);});}
  function write(key,value){memory.set(key,value);try{localStorage.setItem(key,JSON.stringify(value));}catch{if(storageOK)notify('保存できませんでした。ゲーム室を閉じると進捗が失われる場合があります。');storageOK=false;}find('save').textContent=storageOK?'この端末に自動保存':'この画面内に保存中';}
  function save(){write(PREFIX+puzzle.id,serializeGame(game));book[puzzle.id]={completed:game.completed,started:game.cells.some(v=>v!==0)};write(PREFIX+'current',puzzle.id);onUpdate({id:'nonogram',puzzleId:puzzle.id,completed:game.completed});}
  function renderBoard(){
    const n=puzzle.size,maxGroups=Math.max(...clues.rows.map(line=>line.length)),clueWidth=Math.max(n===5?42:58,maxGroups*7+(maxGroups-1)*3+12);
    board.style.setProperty('--ngm-n',n);board.style.setProperty('--ngm-clue-width',`${clueWidth}px`);board.style.setProperty('--ngm-zoom-width',`${clueWidth+n*30}px`);board.classList.toggle('ngm-small',n===5);board.classList.toggle('ngm-large',n===15);board.classList.toggle('ngm-zoomed',zoomed);board.setAttribute('aria-label',`${n}行${n}列のお絵描きロジック盤面`);
    find('view-controls').hidden=n<15;find('zoom').setAttribute('aria-pressed',String(zoomed));find('zoom').textContent=zoomed?'全体を表示':'拡大して入力';find('pan-controls').hidden=!zoomed;
    let html='<div class="ngm-corner" aria-hidden="true"></div>';
    for(let col=0;col<n;col++){const line=Array.from({length:n},(_,row)=>game.cells[row*n+col]),done=lineMatches(line,clues.cols[col]);html+=`<div class="ngm-clue ngm-col-clue ${done?'ngm-clue-done':''}" aria-label="${col+1}列のヒント ${clues.cols[col].join('、')}">${clues.cols[col].map(v=>`<span>${v}</span>`).join('')}</div>`;}
    for(let row=0;row<n;row++){
      const line=game.cells.slice(row*n,(row+1)*n),done=lineMatches(line,clues.rows[row]);
      html+=`<div class="ngm-clue ngm-row-clue ${done?'ngm-clue-done':''}" aria-label="${row+1}行のヒント ${clues.rows[row].join('、')}">${clues.rows[row].map(v=>`<span>${v}</span>`).join('')}</div>`;
      for(let col=0;col<n;col++){const index=row*n+col,value=game.cells[index];html+=`<button type="button" role="gridcell" class="ngm-cell ${value===1?'ngm-filled':value===-1?'ngm-cross':''} ${(col+1)%5===0?'ngm-block-right':''} ${(row+1)%5===0?'ngm-block-bottom':''} ${errors.includes(index)?'ngm-error':''} ${revealed===index?'ngm-revealed':''}" data-index="${index}" aria-label="${row+1}行${col+1}列、${value===1?'塗ったマス':value===-1?'×':'未入力'}" aria-rowindex="${row+1}" aria-colindex="${col+1}" aria-readonly="${game.completed}" tabindex="${index===focused?0:-1}">${value===-1?'<span aria-hidden="true">×</span>':''}</button>`;}
    }
    board.innerHTML=html;
    find('progress').textContent=`${game.cells.filter(v=>v===1).length} / ${solutionFor(puzzle).filter(Boolean).length}`;
    find('status').textContent=game.completed?'きれいな絵が、できました。':mode===1?'塗るモード · 同じマスをタップで取り消し':mode===-1?'×モード · 塗らないマスに印を付けよう':'消すモード · 入力を消せます';
  }
  function render(){
    find('number').textContent=String(PUZZLES.indexOf(puzzle)+1).padStart(3,'0');find('size').textContent=`${puzzle.size} × ${puzzle.size}`;find('time').textContent=time(game.elapsed);renderBoard();
    container.querySelectorAll('[data-mode]').forEach(button=>{button.setAttribute('aria-pressed',String(Number(button.dataset.mode)===mode));button.disabled=game.completed;});
    find('undo').disabled=!game.history.length;find('hint').disabled=game.completed;find('check').disabled=game.completed;
    find('completion').hidden=!game.completed;
    if(game.completed){find('picture-title').textContent=puzzle.title;find('clear-stats').textContent=`${time(game.elapsed)} · ヒント ${game.hints}回`;}
  }
  function applied(result){if(!result.changed)return;const before=game.completed;game=result.state;errors=[];save();render();if(!before&&game.completed)notify(`「${puzzle.title}」が完成しました！`);}
  function loadPuzzle(id){save();puzzle=PUZZLES.find(p=>p.id===id)||PUZZLES[0];game=createGame(puzzle,read(PREFIX+puzzle.id));clues=cluesFor(puzzle.rows);focused=0;errors=[];revealed=-1;stroke=null;zoomed=false;find('board-scroll').scrollLeft=0;fraction=0;last=performance.now();lastSaved=-1;library.close();save();render();}
  function renderLibrary(){
    const matching=libraryPuzzles(),pages=Math.max(1,Math.ceil(matching.length/pageSize));
    libraryPage=Math.max(0,Math.min(libraryPage,pages-1));
    container.querySelectorAll('[data-size]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.size)===filter)));
    container.querySelectorAll('[data-progress]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.progress===statusFilter)));
    find('puzzles').innerHTML=matching.slice(libraryPage*pageSize,(libraryPage+1)*pageSize).map(p=>{const s=progressFor(p);return `<button class="ngm-puzzle ${s.completed?'ngm-puzzle-done':''} ${p.id===puzzle.id?'ngm-puzzle-current':''}" data-puzzle="${p.id}" aria-label="問題${PUZZLES.indexOf(p)+1}、${p.size}かける${p.size}${s.completed?'、クリア済み':s.started?'、途中':''}"><strong>${String(PUZZLES.indexOf(p)+1).padStart(3,'0')}${s.completed?'<i>✓</i>':''}</strong><small>${p.size} × ${p.size}</small><span>${s.completed?p.title:s.started?'途中から':'まだ見ぬ絵'}</span></button>`;}).join('');
    find('empty').hidden=matching.length>0;
    find('page-back').disabled=libraryPage===0;find('page-next').disabled=libraryPage===pages-1;
    find('page-range').textContent=matching.length?`${libraryPage*pageSize+1}–${Math.min((libraryPage+1)*pageSize,matching.length)} / ${matching.length}問`:'0問';
    find('book-progress').textContent=`${PUZZLES.filter(p=>progressFor(p).completed).length} / ${PUZZLES.length} 枚のお絵描きが完成`;
    find('puzzles').scrollTop=0;
  }
  function openLibrary(){save();book={};const index=libraryPuzzles().findIndex(p=>p.id===puzzle.id);libraryPage=index<0?0:Math.floor(index/pageSize);renderLibrary();library.showModal();library.scrollTop=0;}
  function next(){const index=PUZZLES.indexOf(puzzle),ordered=[...PUZZLES.slice(index+1),...PUZZLES.slice(0,index+1)];const target=ordered.find(p=>!progressFor(p).completed);if(target)loadPuzzle(target.id);else{openLibrary();notify('すべての絵が完成しました。おめでとうございます！');}}
  function click(event){
    const button=event.target.closest('button');if(!button||disposed)return;
    if(button.dataset.mode!==undefined){mode=Number(button.dataset.mode);errors=[];revealed=-1;render();}
    else if(button.dataset.size!==undefined){filter=Number(button.dataset.size);libraryPage=0;renderLibrary();library.scrollTop=0;}
    else if(button.dataset.progress){statusFilter=button.dataset.progress;libraryPage=0;renderLibrary();library.scrollTop=0;}
    else if(button.dataset.ngm==='page-back'||button.dataset.ngm==='page-next'){libraryPage+=button.dataset.ngm==='page-next'?1:-1;renderLibrary();library.scrollTop=0;}
    else if(button.dataset.ngm==='zoom'){zoomed=!zoomed;renderBoard();find('board-scroll').scrollLeft=0;find('pan').value=0;}
    else if(button.dataset.puzzle)loadPuzzle(button.dataset.puzzle);
    else if(button.dataset.ngm==='library')openLibrary();
    else if(button.dataset.ngm==='close-library')library.close();
    else if(button.dataset.ngm==='undo'){revealed=-1;applied(undo(game,puzzle));}
    else if(button.dataset.ngm==='hint'){const result=hint(game,puzzle);revealed=result.index;applied(result);if(result.changed&&!game.completed)notify(`${Math.floor(result.index/puzzle.size)+1}行${result.index%puzzle.size+1}列をお手伝いしました`);}
    else if(button.dataset.ngm==='check'){errors=wrongCells(game,puzzle);renderBoard();notify(errors.length?`${errors.length}マスの入力を見直してみましょう。色を付けて表示しました。`:'今のところ、入力したマスに間違いはありません。');}
    else if(button.dataset.ngm==='next')next();
    else if(button.dataset.ngm==='reset'){if(game.cells.some(v=>v!==0)&&!confirm('この問題の入力とタイムをリセットして、最初から始めますか？'))return;game=createGame(puzzle);errors=[];revealed=-1;fraction=0;last=performance.now();save();render();}
    else if(button.dataset.index!==undefined&&event.detail===0&&!game.completed){focused=Number(button.dataset.index);revealed=-1;applied(paintCells(game,puzzle,[focused],game.cells[focused]===mode?0:mode));board.querySelector(`[data-index="${focused}"]`)?.focus({preventScroll:true});}
  }
  function updateStroke(index){
    if(!stroke)return;const n=puzzle.size,startRow=Math.floor(stroke.start/n),startCol=stroke.start%n,row=Math.floor(index/n),col=index%n;
    if(!stroke.axis&&index!==stroke.start)stroke.axis=Math.abs(col-startCol)>=Math.abs(row-startRow)?'h':'v';
    const end=stroke.axis==='h'?col:row,from=stroke.axis==='h'?startCol:startRow;
    if(stroke.axis)for(let p=Math.min(from,end);p<=Math.max(from,end);p++)stroke.indices.add(stroke.axis==='h'?startRow*n+p:p*n+startCol);
    const result=paintCells(stroke.base,puzzle,[...stroke.indices],stroke.value),elapsed=game.elapsed;
    game=result.state;game.elapsed=elapsed;errors=[];revealed=-1;render();
  }
  function pointerDown(event){const cell=event.target.closest('[data-index]');if(!cell||game.completed||!event.isPrimary||event.button!==0||stroke)return;event.preventDefault();focused=Number(cell.dataset.index);stroke={start:focused,pointerId:event.pointerId,indices:new Set([focused]),base:game,value:game.cells[focused]===mode?0:mode,axis:null};board.setPointerCapture(event.pointerId);updateStroke(focused);}
  function pointerMove(event){if(!stroke||event.pointerId!==stroke.pointerId)return;const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-index]');if(cell&&board.contains(cell))updateStroke(Number(cell.dataset.index));}
  function pointerEnd(event){if(!stroke||event&&event.pointerId!==stroke.pointerId)return;const before=stroke.base.completed;stroke=null;save();render();if(!before&&game.completed)notify(`「${puzzle.title}」が完成しました！`);}
  function keydown(event){
    const cell=event.target.closest('[data-index]');if(!cell||game.completed||library.open)return;let index=Number(cell.dataset.index),n=puzzle.size;
    const target=event.key==='ArrowRight'?Math.floor(index/n)*n+(index%n+1)%n:event.key==='ArrowLeft'?Math.floor(index/n)*n+(index%n+n-1)%n:event.key==='ArrowUp'?(index+n*n-n)%(n*n):event.key==='ArrowDown'?(index+n)%(n*n):null;
    if(target!==null){event.preventDefault();focused=target;board.querySelectorAll('[data-index]').forEach(el=>el.tabIndex=Number(el.dataset.index)===target?0:-1);board.querySelector(`[data-index="${target}"]`)?.focus();}
    else if([' ','Enter','x','X','e','E'].includes(event.key)){event.preventDefault();focused=index;const chosen=event.key.toLowerCase()==='x'?-1:event.key.toLowerCase()==='e'?0:mode;revealed=-1;applied(paintCells(game,puzzle,[index],game.cells[index]===chosen?0:chosen));board.querySelector(`[data-index="${index}"]`)?.focus({preventScroll:true});}
  }
  function tick(){const now=performance.now();if(!game.completed&&game.cells.some(v=>v!==0)&&!document.hidden&&!document.querySelector('dialog[open]')){fraction+=now-last;if(fraction>=1000){const seconds=Math.floor(fraction/1000);game.elapsed+=seconds;fraction-=seconds*1000;find('time').textContent=time(game.elapsed);}if(game.elapsed%5===0&&game.elapsed!==lastSaved){save();lastSaved=game.elapsed;}}last=now;}
  function visibility(){last=performance.now();if(document.hidden)save();}
  function pan(event){if(event.target.dataset.ngm==='pan'){const scroll=find('board-scroll');scroll.scrollLeft=(scroll.scrollWidth-scroll.clientWidth)*Number(event.target.value)/100;}}
  container.addEventListener('click',click);container.addEventListener('input',pan);board.addEventListener('pointerdown',pointerDown);board.addEventListener('pointermove',pointerMove);board.addEventListener('pointerup',pointerEnd);board.addEventListener('pointercancel',pointerEnd);board.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',visibility);
  library.addEventListener('click',event=>{const r=library.getBoundingClientRect();if(event.target===library&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))library.close();});
  const timer=setInterval(tick,250);save();render();
  return ()=>{if(disposed)return;pointerEnd();tick();save();disposed=true;clearInterval(timer);container.removeEventListener('click',click);container.removeEventListener('input',pan);board.removeEventListener('pointerdown',pointerDown);board.removeEventListener('pointermove',pointerMove);board.removeEventListener('pointerup',pointerEnd);board.removeEventListener('pointercancel',pointerEnd);board.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',visibility);library.close();library.remove();};
}
