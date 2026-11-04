import {PUZZLES} from './binary-puzzles.mjs';
import {createGame,enterCell,undo,hint,wrongCells,ruleViolations,isComplete,serializeGame} from './binary-engine.mjs';

const PREFIX='yohaku-games:v1:binary:',memory=new Map();
const read=(key,fallback=null)=>{if(memory.has(key))return memory.get(key);try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch{return fallback;}};
const time=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
const sun='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
const moon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.1A9 9 0 0 1 8.9 3.6a9 9 0 1 0 11.5 11.5Z"/></svg>';
const mark=value=>value===1?sun:value===2?moon:'';
export function mount(container,{notify=()=>{},onUpdate=()=>{}}={}){
  let puzzle=PUZZLES.find(p=>p.id===read(PREFIX+'current'))||PUZZLES[0],game=createGame(puzzle,read(PREFIX+puzzle.id));
  let mode=-1,focused=0,errors=[],revealed=-1,disposed=false,storageOK=true,filter=0,statusFilter='all',page=0,book={},last=performance.now(),fraction=0,lastSaved=-1;
  const pageSize=24;
  container.innerHTML=`<section class="bn-game" aria-label="二択ロジックのゲーム"><div class="bn-toolbar"><button class="bn-select" data-bn="library">No. <strong data-bn="number"></strong><small data-bn="size"></small><span aria-hidden="true">⌄</span></button><span class="bn-time" data-bn="time">00:00</span></div><div class="bn-balance"><span>${sun}太陽 <b data-bn="half-sun"></b></span><i>ずつ、各行・各列に</i><span>${moon}月 <b data-bn="half-moon"></b></span></div><div class="bn-board" data-bn="board" role="grid" aria-label="二択ロジックの盤面"></div><div class="bn-caption"><span data-bn="status"></span><span data-bn="progress"></span></div><div class="bn-modes" aria-label="入力モード"><button data-bn-mode="-1" aria-pressed="true">順に切替</button><button data-bn-mode="1" aria-pressed="false">${sun}太陽</button><button data-bn-mode="2" aria-pressed="false">${moon}月</button><button data-bn-mode="0" aria-pressed="false">消す</button></div><div class="bn-actions"><button data-bn="undo"><span aria-hidden="true">↶</span>元に戻す</button><button data-bn="hint"><span aria-hidden="true">☼</span>ヒント</button><button data-bn="check"><span aria-hidden="true">✓</span>確認</button></div><div class="bn-completion" data-bn="completion" hidden><span>LOGIC COMPLETE</span><h2>きれいに、揃いました。</h2><p data-bn="clear-stats"></p><button data-bn="next">次の問題へ →</button></div><div class="bn-bottom"><span data-bn="save">この端末に自動保存</span><button data-bn="reset">この問題を最初から</button></div><p class="bn-tip">同じマークは3つ続けない。<br>同じ行どうし・列どうしの並びも、違う形に。</p></section><dialog class="bn-library"><div class="bn-library-header"><div><small>YOUR LOGIC BOOK</small><h2>二択ロジックの問題集</h2></div><button data-bn="close-library" aria-label="問題集を閉じる">×</button></div><p class="bn-library-description">全${PUZZLES.length}問。小さな盤面から、じっくりどうぞ。</p><div class="bn-library-filter" aria-label="盤面サイズで絞り込む"><button data-bn-size="0">すべて</button><button data-bn-size="6">6 × 6</button><button data-bn-size="8">8 × 8</button><button data-bn-size="10">10 × 10</button></div><div class="bn-library-state" aria-label="進み具合で絞り込む"><button data-bn-progress="all">すべて</button><button data-bn-progress="unplayed">未クリア</button><button data-bn-progress="started">途中</button><button data-bn-progress="completed">クリア</button></div><div class="bn-puzzle-grid" data-bn="puzzles"></div><p class="bn-library-empty" data-bn="empty" hidden>この条件に合う問題はまだありません。</p><nav class="bn-library-pages" aria-label="問題集のページ"><button data-bn="page-back">← 前へ</button><span data-bn="range" aria-live="polite"></span><button data-bn="page-next">次へ →</button></nav><p class="bn-library-progress" data-bn="book-progress"></p></dialog>`;
  const find=name=>container.querySelector(`[data-bn="${name}"]`),board=find('board'),library=container.querySelector('.bn-library');
  function write(key,value){memory.set(key,value);try{localStorage.setItem(key,JSON.stringify(value));}catch{if(storageOK)notify('保存できませんでした。ゲーム室を閉じると進捗が失われる場合があります。');storageOK=false;}find('save').textContent=storageOK?'この端末に自動保存':'この画面内に保存中';}
  function save(){write(PREFIX+puzzle.id,serializeGame(game));write(PREFIX+'current',puzzle.id);book[puzzle.id]={completed:game.completed,started:game.moves>0||game.cells.some((v,i)=>v!==Number(puzzle.givens[i]))};onUpdate({id:'binary',puzzleId:puzzle.id,completed:game.completed});}
  function progressFor(p){
    if(book[p.id])return book[p.id];
    const saved=read(PREFIX+p.id),givens=Array.from(p.givens,Number),cells=saved?.puzzleId===p.id&&Array.isArray(saved.cells)&&saved.cells.length===p.size*p.size&&saved.cells.every((v,i)=>[0,1,2].includes(v)&&(!givens[i]||givens[i]===v))?saved.cells:null;
    return book[p.id]={completed:!!cells&&isComplete(cells,p.size),started:!!cells&&(saved.moves>0||cells.some((v,i)=>v!==givens[i]))};
  }
  function matching(){return PUZZLES.filter(p=>{const s=progressFor(p);return (!filter||p.size===filter)&&(statusFilter==='all'||statusFilter==='unplayed'&&!s.completed||statusFilter==='started'&&s.started&&!s.completed||statusFilter==='completed'&&s.completed);});}
  function renderBoard(){
    const n=puzzle.size;board.style.setProperty('--bn-n',n);board.setAttribute('aria-label',`${n}行${n}列の二択ロジック盤面`);
    board.innerHTML=game.cells.map((value,index)=>{const fixed=puzzle.givens[index]!=='0';return `<button type="button" role="gridcell" class="bn-cell ${value===1?'bn-sun':value===2?'bn-moon':''} ${fixed?'bn-given':''} ${errors.includes(index)?'bn-error':''} ${revealed===index?'bn-revealed':''}" data-bn-cell="${index}" aria-label="${Math.floor(index/n)+1}行${index%n+1}列、${value===1?'太陽':value===2?'月':'未入力'}${fixed?'、固定マス':''}" aria-rowindex="${Math.floor(index/n)+1}" aria-colindex="${index%n+1}" aria-readonly="${fixed||game.completed}" tabindex="${index===focused?0:-1}">${mark(value)}${fixed?'<i aria-hidden="true"></i>':''}</button>`;}).join('');
    find('progress').textContent=`${game.cells.filter(Boolean).length} / ${n*n}`;
    find('status').textContent=game.completed?'太陽と月が、揃いました。':mode===-1?'タップで 太陽 → 月 → 空白':mode===1?'太陽を入力 · 同じマスで取り消し':mode===2?'月を入力 · 同じマスで取り消し':'消すモード';
  }
  function render(){
    find('number').textContent=String(PUZZLES.indexOf(puzzle)+1).padStart(3,'0');find('size').textContent=`${puzzle.size} × ${puzzle.size}`;find('time').textContent=time(game.elapsed);find('half-sun').textContent=puzzle.size/2;find('half-moon').textContent=puzzle.size/2;renderBoard();
    container.querySelectorAll('[data-bn-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.bnMode)===mode));b.disabled=game.completed;});
    find('undo').disabled=!game.history.length;find('hint').disabled=game.completed;find('check').disabled=game.completed;find('completion').hidden=!game.completed;
    if(game.completed)find('clear-stats').textContent=`${time(game.elapsed)} · ${game.moves}手 · ヒント ${game.hints}回`;
  }
  function applied(result){if(!result.changed)return;const before=game.completed;game=result.state;errors=[];save();render();if(!before&&game.completed)notify('二択ロジックをクリアしました！');}
  function loadPuzzle(id){tick();save();puzzle=PUZZLES.find(p=>p.id===id)||PUZZLES[0];game=createGame(puzzle,read(PREFIX+puzzle.id));focused=0;errors=[];revealed=-1;fraction=0;last=performance.now();lastSaved=-1;library.close();save();render();}
  function renderLibrary(){
    const matches=matching(),pages=Math.max(1,Math.ceil(matches.length/pageSize));page=Math.max(0,Math.min(page,pages-1));
    container.querySelectorAll('[data-bn-size]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.bnSize)===filter)));
    container.querySelectorAll('[data-bn-progress]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bnProgress===statusFilter)));
    find('puzzles').innerHTML=matches.slice(page*pageSize,(page+1)*pageSize).map(p=>{const s=progressFor(p),number=PUZZLES.indexOf(p)+1;return `<button class="bn-puzzle ${s.completed?'bn-puzzle-done':''} ${p.id===puzzle.id?'bn-puzzle-current':''}" data-bn-puzzle="${p.id}" aria-label="問題${number}、${p.size}かける${p.size}${s.completed?'、クリア済み':s.started?'、途中':''}"><strong>${String(number).padStart(3,'0')}${s.completed?'<i>✓</i>':''}</strong><small>${p.size} × ${p.size}</small><span>${s.completed?'クリア':s.started?'途中から':'これから'}</span></button>`;}).join('');
    find('puzzles').scrollTop=0;find('empty').hidden=!!matches.length;find('page-back').disabled=page===0;find('page-next').disabled=page===pages-1;find('range').textContent=matches.length?`${page*pageSize+1}–${Math.min((page+1)*pageSize,matches.length)} / ${matches.length}問`:'0問';find('book-progress').textContent=`${PUZZLES.filter(p=>progressFor(p).completed).length} / ${PUZZLES.length}問クリア`;
  }
  function openLibrary(){tick();save();book={};const index=matching().findIndex(p=>p.id===puzzle.id);page=index<0?0:Math.floor(index/pageSize);renderLibrary();library.showModal();library.scrollTop=0;}
  function next(){const index=PUZZLES.indexOf(puzzle),ordered=[...PUZZLES.slice(index+1),...PUZZLES.slice(0,index+1)],target=ordered.find(p=>!progressFor(p).completed);if(target)loadPuzzle(target.id);else{openLibrary();notify('200問すべてクリア。おめでとうございます！');}}
  function input(index,value=mode){
    if(game.completed)return;
    if(puzzle.givens[index]!=='0'){notify('初めからあるマークは変更できません。');return;}
    focused=index;revealed=-1;
    const chosen=value===-1?(game.cells[index]+1)%3:game.cells[index]===value?0:value;
    applied(enterCell(game,puzzle,index,chosen));
  }
  function click(event){
    const b=event.target.closest('button');if(!b||disposed)return;
    if(b.dataset.bnCell!==undefined)input(Number(b.dataset.bnCell));
    else if(b.dataset.bnMode!==undefined){mode=Number(b.dataset.bnMode);errors=[];revealed=-1;render();}
    else if(b.dataset.bnSize!==undefined){filter=Number(b.dataset.bnSize);page=0;renderLibrary();library.scrollTop=0;}
    else if(b.dataset.bnProgress){statusFilter=b.dataset.bnProgress;page=0;renderLibrary();library.scrollTop=0;}
    else if(b.dataset.bnPuzzle)loadPuzzle(b.dataset.bnPuzzle);
    else if(b.dataset.bn==='library')openLibrary();
    else if(b.dataset.bn==='close-library')library.close();
    else if(b.dataset.bn==='page-back'||b.dataset.bn==='page-next'){page+=b.dataset.bn==='page-next'?1:-1;renderLibrary();library.scrollTop=0;}
    else if(b.dataset.bn==='undo'){revealed=-1;applied(undo(game,puzzle));}
    else if(b.dataset.bn==='hint'){const result=hint(game,puzzle);revealed=result.index;applied(result);if(result.changed&&!game.completed)notify(`${Math.floor(result.index/puzzle.size)+1}行${result.index%puzzle.size+1}列をお手伝いしました`);}
    else if(b.dataset.bn==='check'){errors=[...new Set([...wrongCells(game,puzzle),...ruleViolations(game.cells,puzzle.size)])];renderBoard();notify(errors.length?`${errors.length}マスの入力を見直してみましょう。色を付けて表示しました。`:'今のところ、入力したマスに間違いはありません。');}
    else if(b.dataset.bn==='next')next();
    else if(b.dataset.bn==='reset'){if(game.moves&&!confirm('この問題の入力とタイムをリセットして、最初から始めますか？'))return;game=createGame(puzzle);errors=[];revealed=-1;fraction=0;last=performance.now();save();render();}
  }
  function keydown(event){
    const cell=event.target.closest('[data-bn-cell]');if(!cell||library.open||game.completed)return;
    const index=Number(cell.dataset.bnCell),n=puzzle.size;
    const target=event.key==='ArrowRight'?Math.floor(index/n)*n+(index%n+1)%n:event.key==='ArrowLeft'?Math.floor(index/n)*n+(index%n+n-1)%n:event.key==='ArrowUp'?(index+n*n-n)%(n*n):event.key==='ArrowDown'?(index+n)%(n*n):null;
    if(target!==null){event.preventDefault();focused=target;board.querySelectorAll('[data-bn-cell]').forEach(el=>el.tabIndex=Number(el.dataset.bnCell)===target?0:-1);board.querySelector(`[data-bn-cell="${target}"]`)?.focus();}
    else if(['1','2','0','Delete','Backspace',' ','Enter'].includes(event.key)){event.preventDefault();input(index,event.key==='1'?1:event.key==='2'?2:['0','Delete','Backspace'].includes(event.key)?0:mode);board.querySelector(`[data-bn-cell="${index}"]`)?.focus({preventScroll:true});}
  }
  function tick(){if(disposed)return;const now=performance.now();if(!game.completed&&game.moves>0&&!document.hidden&&!document.querySelector('dialog[open]')){fraction+=now-last;if(fraction>=1000){const seconds=Math.floor(fraction/1000);game.elapsed+=seconds;fraction-=seconds*1000;find('time').textContent=time(game.elapsed);}if(game.elapsed%5===0&&game.elapsed!==lastSaved){save();lastSaved=game.elapsed;}}last=now;}
  function visibility(){last=performance.now();if(document.hidden)save();}
  function backdrop(event){const r=library.getBoundingClientRect();if(event.target===library&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))library.close();}
  container.addEventListener('click',click);board.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',visibility);library.addEventListener('click',backdrop);
  const timer=setInterval(tick,250);save();render();
  return ()=>{if(disposed)return;tick();save();disposed=true;clearInterval(timer);container.removeEventListener('click',click);board.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',visibility);library.removeEventListener('click',backdrop);library.close();library.remove();};
}
