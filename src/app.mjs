import { createGame, serializeGame, enterNumber, eraseCell, undo, fillNotes, giveHint } from './game.mjs';

const $ = id => document.getElementById(id);
const paths = {
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .3c0 1.7-2.5 1.8-2.5 3.7m0 3h.01"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  undo:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3"/>',
  erase:'<path d="m9 19-6-6a2 2 0 0 1 0-2.8l7.2-7.1a2 2 0 0 1 2.8 0l7 7a2 2 0 0 1 0 2.8L14 19Zm-3-9 9 9m-6 0h12"/>',
  notes:'<path d="m15 3 6 6M4 14 15 3a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3L10 20l-7 1Z"/>',
  candidates:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
  hint:'<path d="M9 18v-2a6 6 0 1 1 6 0v2Zm0 3h6M12 1v1M1 10h1m20 0h1M4 3l1 1m14-1-1 1"/>',
  pause:'<path d="M9 5v14M15 5v14"/>',
  play:'<path d="m8 4 11 8-11 8Z"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
const labels = {5:'ほどよい挑戦',6:'じっくり思考',7:'手ごわい一問',8:'深く、考える',9:'ひらめきの先',10:'とっておきの難問'};
const prefix = 'yohaku-sudoku:v1:';
const memory = new Map();
let storageAvailable = true;
function read(key, fallback) {
  if (memory.has(key)) return memory.get(key);
  try { const raw = localStorage.getItem(prefix + key); return raw === null ? (memory.get(key) ?? fallback) : JSON.parse(raw); }
  catch { return memory.get(key) ?? fallback; }
}
function write(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); }
  catch { if (storageAvailable) toast('保存できませんでした。この画面を閉じると進捗が失われる場合があります。'); storageAvailable = false; }
  $('saved-status').innerHTML = storageAvailable ? '<i></i> 自動保存済み' : 'この画面内に保存中';
}
let puzzles, puzzle, game;
let selected = -1, noteMode = false, paused = false, filter = 0;
let preferences = read('preferences', {autoCheck:false});
if (!preferences || typeof preferences !== 'object') preferences = {autoCheck:false};
preferences.autoCheck = preferences.autoCheck === true;
let summaries = read('summaries', {});
if (!summaries || typeof summaries !== 'object' || Array.isArray(summaries)) summaries = {};
let lastTick = performance.now(), fractionalTime = 0, lastSavedSecond = -1;
const dialogs = [...document.querySelectorAll('dialog')];
const active = () => game && !paused && !game.completed && !document.hidden && !dialogs.some(d => d.open);
const timeLabel = seconds => {
  const s = Math.max(0, Math.floor(seconds));
  return s >= 3600 ? `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};
let toastTimeout;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3200); }
function tick() {
  const now = performance.now();
  if (active()) {
    fractionalTime += now - lastTick;
    if (fractionalTime >= 1000) { const seconds = Math.floor(fractionalTime / 1000); game.elapsed += seconds; fractionalTime -= seconds * 1000; $('timer').textContent = timeLabel(game.elapsed); }
    if (game.elapsed > 0 && game.elapsed % 5 === 0 && game.elapsed !== lastSavedSecond) { save(); lastSavedSecond = game.elapsed; }
  }
  lastTick = now;
}
function save() {
  if (!game) return;
  const data = serializeGame(game);
  // Persist a useful undo stack without exhausting mobile browsers' storage quota.
  data.history = data.history.slice(-25);
  write(`puzzle:${puzzle.id}`, data);
  summaries[puzzle.id] = {completed:game.completed,started:game.board.some((n,i)=>n!==Number(puzzle.givens[i])) || game.notes.some(Boolean),elapsed:game.elapsed,hints:game.hints};
  write('summaries', summaries);
  write('current', puzzle.id);
}
function loadPuzzle(id) {
  if (game) { tick(); save(); }
  puzzle = puzzles.find(p=>p.id === id) || puzzles[0];
  game = createGame(puzzle, read(`puzzle:${puzzle.id}`, null));
  selected = -1; paused = false; noteMode = false;
  fractionalTime = 0; lastTick = performance.now(); lastSavedSecond = -1;
  dialogs.forEach(dialog=>dialog.close());
  loadingButtons.forEach(button=>button.disabled=false);
  $('board').setAttribute('aria-busy','false');
  save(); render();
  if (game.completed) $('game-status').textContent = 'クリア済み。別の問題にも挑戦してみましょう。';
}

const cells = [];
for (let index=0;index<81;index++) {
  const cell=document.createElement('button');
  cell.className='cell'; cell.type='button'; cell.setAttribute('role','gridcell');
  cell.setAttribute('aria-rowindex',Math.floor(index/9)+1);cell.setAttribute('aria-colindex',index%9+1);
  cell.addEventListener('click',()=>selectCell(index));
  $('board').append(cell); cells.push(cell);
}
for (let digit=1;digit<=9;digit++) {
  const button=document.createElement('button');button.className='number-key';button.type='button';
  button.innerHTML=`<span>${digit}</span><small>9</small>`;
  button.addEventListener('click',()=>input(digit));
  $('number-pad').append(button);
}
$('help-button').innerHTML=icon('help');
document.querySelectorAll('.close-dialog.icon-button').forEach(button=>button.innerHTML=icon('close'));
for (const [id,name] of Object.entries({'undo-button':'undo','erase-button':'erase','notes-button':'notes','candidates-button':'candidates','hint-button':'hint'})) $(id).querySelector('.tool-icon').innerHTML=icon(name);

function peer(a,b) { return Math.floor(a/9)===Math.floor(b/9) || a%9===b%9 || (Math.floor(a/27)===Math.floor(b/27)&&Math.floor((a%9)/3)===Math.floor((b%9)/3)); }
function conflicts() {
  const result=new Set();
  game.board.forEach((value,i)=>{if(!value)return;for(let j=i+1;j<81;j++)if(game.board[j]===value&&peer(i,j)){result.add(i);result.add(j);}});
  return result;
}
function renderBoard() {
  const bad=conflicts(); const selectedValue=game.board[selected];
  cells.forEach((cell,index)=>{
    const n=game.board[index], given=puzzle.givens[index]!=='0';
    cell.className=['cell',given?'given':'',selected>=0&&peer(index,selected)?'peer':'',selectedValue&&n===selectedValue?'same':'',selected===index?'selected':'',bad.has(index)?'conflict':'',preferences.autoCheck&&n&&!given&&n!==Number(puzzle.solution[index])?'wrong':''].filter(Boolean).join(' ');
    cell.setAttribute('aria-selected',String(selected===index));
    cell.tabIndex=selected===index || (selected<0&&index===0) ? 0 : -1;
    if (n) cell.textContent=n;
    else if(game.notes[index])cell.innerHTML=`<span class="cell-notes">${Array.from({length:9},(_,i)=>`<span>${game.notes[index]&(1<<i)?i+1:''}</span>`).join('')}</span>`;
    else cell.textContent='';
    const notes=Array.from({length:9},(_,i)=>game.notes[index]&(1<<i)?i+1:null).filter(Boolean);
    cell.setAttribute('aria-label',`${Math.floor(index/9)+1}行${index%9+1}列、${n?`${n}${given?'、固定数字':''}`:notes.length?`メモ ${notes.join('、')}`:'空きマス'}`);
  });
  $('filled-count').textContent=`${game.board.filter(Boolean).length} / 81`;
  [...$('number-pad').children].forEach((key,i)=>{
    const left=9-game.board.filter(n=>n===i+1).length;
    key.querySelector('small').textContent=left>0?left:'✓';
    key.classList.toggle('finished',left<=0);
    key.disabled=paused||game.completed;
    key.setAttribute('aria-label',`${i+1}を入力、残り${Math.max(0,left)}マス`);
  });
  $('undo-button').disabled=paused||!game.history.length;
  $('erase-button').disabled=paused||game.completed||selected<0||puzzle.givens[selected]!=='0'||(!game.board[selected]&&!game.notes[selected]);
  for(const id of ['notes-button','candidates-button','hint-button'])$(id).disabled=paused||game.completed;
  $('notes-button').classList.toggle('active',noteMode);
  $('notes-button').setAttribute('aria-pressed',String(noteMode));
  $('note-mode-label').textContent=noteMode?'ON':'OFF';
  $('pause-overlay').hidden=!paused;
  $('board-wrap').classList.toggle('is-paused',paused);
  $('pause-icon').innerHTML=icon(paused?'play':'pause');
  $('pause-button').setAttribute('aria-label',paused?'プレイを再開':'一時停止');
  $('pause-button').disabled=game.completed;
  $('game-status').textContent=game.completed?'クリア済み。おつかれさまでした。':noteMode?'メモモード：候補の数字を記入':selected>=0&&puzzle.givens[selected]!=='0'?'初めからある数字です':selected>=0?'数字を選んで入力':'マスを選んで、数字を入力';
}
function renderCollection() {
  const completed=puzzles.filter(p=>summaries[p.id]?.completed).length;
  $('collection-count').innerHTML=`${completed} <small>/ 100</small>`;
  $('collection-progress-fill').style.width=`${completed}%`;
  $('level-list').innerHTML=Object.entries(labels).map(([level,label])=>{
    const set=puzzles.filter(p=>p.level===Number(level));const done=set.filter(p=>summaries[p.id]?.completed).length;
    return `<button class="level-option ${puzzle.level===Number(level)?'active':''}" data-level="${level}" aria-label="レベル${level} ${label}の問題を選ぶ"><span class="level-n">Level ${level}</span><span class="level-name">${label}</span><span class="level-dots" aria-hidden="true">${Array.from({length:6},(_,i)=>`<i class="${i<=Number(level)-5?'on':''}"></i>`).join('')}</span><span class="level-completion">${done}/${set.length}</span></button>`;
  }).join('');
}
function render() {
  $('current-level').textContent=`LEVEL ${puzzle.level}`;
  $('puzzle-number').textContent=`No. ${String(puzzle.id).padStart(3,'0')}`;
  $('timer').textContent=timeLabel(game.elapsed);
  renderBoard();renderCollection();
}
function selectCell(index,focus=false) {
  if(paused)return;
  selected=index;renderBoard();
  if(focus)cells[index].focus({preventScroll:true});
}
function action(result) {
  if(!result.changed)return;
  const wasComplete=game.completed;game=result.game;save();renderBoard();renderCollection();
  if(!wasComplete&&game.completed)showCompletion();
}
function input(digit) {
  if(paused||game.completed)return;
  if(selected<0){toast('先に、入力するマスを選んでください');return;}
  if(puzzle.givens[selected]!=='0'){toast('初めからある数字は変更できません');return;}
  if(noteMode&&game.board[selected]){toast('数字を消してからメモを記入できます');return;}
  action(enterNumber(game,puzzle,selected,digit,{noteMode,autoCheck:preferences.autoCheck}));
}
function openDialog(dialog) { tick();dialog.showModal();lastTick=performance.now(); }
function openLibrary(level=0) { filter=level;renderLibrary();openDialog($('library-dialog')); }
function renderLibrary() {
  $('library-filters').innerHTML=[0,5,6,7,8,9,10].map(level=>`<button data-filter="${level}" class="${filter===level?'active':''}" aria-pressed="${filter===level}">${level?`Lv.${level}`:'すべて'}</button>`).join('');
  $('puzzle-grid').innerHTML=puzzles.filter(p=>!filter||p.level===filter).map(p=>{
    const summary=summaries[p.id]; const state=summary?.completed?'complete':summary?.started?'started':'';
    return `<button class="puzzle-tile ${state} ${p.id===puzzle.id?'current':''}" data-puzzle="${p.id}" aria-label="問題${p.id}、レベル${p.level}${summary?.completed?'、クリア済み':summary?.started?'、途中':''}${p.id===puzzle.id?'、プレイ中':''}"><strong>${String(p.id).padStart(3,'0')}</strong><small>LEVEL ${p.level}</small></button>`;
  }).join('');
}
function showCompletion() {
  $('completion-description').textContent=`No. ${String(puzzle.id).padStart(3,'0')} · Level ${puzzle.level} をクリアしました。`;
  $('completion-time').textContent=timeLabel(game.elapsed);
  $('completion-hints').textContent=`${game.hints}回`;
  $('completion-total').textContent=`${puzzles.filter(p=>summaries[p.id]?.completed).length}/100`;
  openDialog($('completion-dialog'));
}
function nextPuzzle() {
  const ordered=[...puzzles.filter(p=>p.id>puzzle.id),...puzzles.filter(p=>p.id<=puzzle.id)];
  const next=ordered.find(p=>!summaries[p.id]?.completed);
  if(next)loadPuzzle(next.id);else{openLibrary();toast('100問すべてクリア。おめでとうございます！');}
}

$('undo-button').addEventListener('click',()=>{if(!paused)action(undo(game));});
$('erase-button').addEventListener('click',()=>{if(!paused)action(eraseCell(game,puzzle,selected));});
$('notes-button').addEventListener('click',()=>{noteMode=!noteMode;renderBoard();});
$('candidates-button').addEventListener('click',()=>{
  if(paused)return;
  if(conflicts().size){toast('重複した数字を直してから、候補を記入してください');return;}
  const result=fillNotes(game,puzzle);action(result);
  toast(result.changed?'空きマスに候補を記入しました。1手で元に戻せます。':'候補はすでに記入されています');
});
$('hint-button').addEventListener('click',()=>{
  if(paused)return;
  const result=giveHint(game,puzzle,selected);
  if(result.changed){selected=result.index;action(result);toast(`${Math.floor(selected/9)+1}行${selected%9+1}列に ${result.digit} が入ります`);}
});
function togglePause(){tick();paused=!paused;lastTick=performance.now();save();renderBoard();}
$('pause-button').addEventListener('click',togglePause);$('resume-button').addEventListener('click',togglePause);
for(const id of ['browse-button','mobile-library','puzzle-label','new-game-button'])$(id).addEventListener('click',()=>openLibrary());
$('level-list').addEventListener('click',event=>{const button=event.target.closest('[data-level]');if(button)openLibrary(Number(button.dataset.level));});
$('library-filters').addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(button){filter=Number(button.dataset.filter);renderLibrary();}});
$('puzzle-grid').addEventListener('click',event=>{const button=event.target.closest('[data-puzzle]');if(button)loadPuzzle(Number(button.dataset.puzzle));});
$('help-button').addEventListener('click',()=>openDialog($('help-dialog')));
$('auto-check').checked=preferences.autoCheck;
$('auto-check').addEventListener('change',()=>{preferences.autoCheck=$('auto-check').checked;write('preferences',preferences);renderBoard();});
$('restart-button').addEventListener('click',()=>{
  if(!confirm('この問題の入力・メモ・タイムをリセットして、最初から始めますか？'))return;
  game=createGame(puzzle);paused=false;selected=-1;fractionalTime=0;save();render();$('help-dialog').close();toast('この問題を最初から始めます');
});
$('next-button').addEventListener('click',nextPuzzle);
for(const dialog of dialogs){
  dialog.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('close',()=>{lastTick=performance.now();});
  dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});
}
document.addEventListener('keydown',event=>{
  if(!game||dialogs.some(d=>d.open)||event.target.matches('input,textarea'))return;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(!paused)action(undo(game));return;}
  if(event.metaKey||event.ctrlKey||event.altKey)return;
  if(/^[1-9]$/.test(event.key)){event.preventDefault();input(Number(event.key));}
  else if(['Backspace','Delete'].includes(event.key)){event.preventDefault();if(!paused)action(eraseCell(game,puzzle,selected));}
  else if(event.key.toLowerCase()==='n'){if(!paused&&!game.completed){noteMode=!noteMode;renderBoard();}}
  else if(event.key==='Escape'){event.preventDefault();if(!game.completed)togglePause();}
  else if(event.key.startsWith('Arrow')){
    event.preventDefault();if(paused)return;
    let target=selected<0?0:selected;
    if(event.key==='ArrowRight')target=Math.floor(target/9)*9+(target%9+1)%9;
    if(event.key==='ArrowLeft')target=Math.floor(target/9)*9+(target%9+8)%9;
    if(event.key==='ArrowUp')target=(target+72)%81;
    if(event.key==='ArrowDown')target=(target+9)%81;
    selectCell(target,true);
  }
});
document.addEventListener('visibilitychange',()=>{lastTick=performance.now();if(document.hidden)save();});
window.addEventListener('pagehide',()=>{tick();save();});

const loadingButtons=[...document.querySelectorAll('button')];
loadingButtons.forEach(button=>button.disabled=true);
$('board').setAttribute('aria-busy','true');
$('game-status').textContent='問題を読み込んでいます…';

async function start() {
  try {
    const response=await fetch(new URL('../puzzles.json',import.meta.url));
    if(!response.ok)throw new Error('Puzzle data unavailable');
    puzzles=await response.json();
    if(!Array.isArray(puzzles)||puzzles.length!==100)throw new Error('Invalid puzzle collection');
    loadPuzzle(Number(read('current',1)));
    try { localStorage.setItem('yohaku-games:last',JSON.stringify({id:'sudoku',playedAt:Date.now()})); } catch {}
    setInterval(tick,250);
    if('serviceWorker' in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});
  }catch(error){
    console.error(error);$('game-status').textContent='問題を読み込めませんでした。ページを再読み込みしてください。';
    $('saved-status').textContent='読み込みエラー';toast('問題の読み込みに失敗しました。接続を確認して再読み込みしてください。');
  }
}
start();
