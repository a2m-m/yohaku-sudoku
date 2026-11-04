import {createGame,legalMoves,flipsFor,playMove,undoMove,scores,chooseMove,restoreGame,serializeGame} from './reversi-engine.mjs';

const KEY='yohaku-games:v1:reversi';
const memory=new Map();
const names={1:'黒',[-1]:'白'};
const coordinates=index=>`${'ABCDEFGH'[index%8]}${Math.floor(index/8)+1}`;
const icon=path=>`<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const undoIcon=icon('<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3"/>');

export function mount(container,{notify=()=>{},onUpdate=()=>{}}={}){
  let saved=null;
  try{saved=memory.has(KEY)?memory.get(KEY):JSON.parse(localStorage.getItem(KEY));}catch{}
  let state=restoreGame(saved)||createGame();
  let showHints=saved?.showHints!==false,disposed=false,storageOK=true,aiTimer=null,revision=0;
  let highlighted=-1,focusIndex=legalMoves(state.board,state.turn)[0]??0,recentFlips=[];
  container.innerHTML=`<section class="rvs-game" aria-label="オセロの対局">
    <div class="rvs-settings"><label><span>対戦相手</span><select data-rvs="mode" aria-label="オセロの対戦相手"><option value="cpu">コンピューター</option><option value="local">2人で対戦</option></select></label><label data-rvs="difficulty-wrap"><span>コンピューターの強さ</span><select data-rvs="difficulty" aria-label="オセロの難易度"><option value="easy">やさしい</option><option value="normal">ふつう</option><option value="hard">手ごわい</option></select></label><button class="rvs-new" data-rvs="new">新しく始める <span aria-hidden="true">↻</span></button></div>
    <div class="rvs-scores"><div class="rvs-player" data-player="1"><span class="rvs-player-label"><i class="rvs-mini-disc rvs-black"></i><span data-rvs="black-label">あなた</span></span><strong data-rvs="black-score">2</strong></div><div class="rvs-versus"><span>BLACK / WHITE</span><div class="rvs-ratio"><i data-rvs="ratio"></i></div><small data-rvs="move-count">0手</small></div><div class="rvs-player" data-player="-1"><span class="rvs-player-label"><i class="rvs-mini-disc rvs-white"></i><span data-rvs="white-label">コンピューター</span></span><strong data-rvs="white-score">2</strong></div></div>
    <div class="rvs-turn" data-rvs="turn" role="status" aria-live="polite"></div>
    <div class="rvs-coordinates" aria-hidden="true">${Array.from('ABCDEFGH',x=>`<span>${x}</span>`).join('')}</div>
    <div class="rvs-board" role="grid" aria-label="8行8列のオセロ盤面" aria-rowcount="8" aria-colcount="8" data-rvs="board"></div>
    <div class="rvs-board-caption"><span data-rvs="caption"></span><span data-rvs="empty-count"></span></div>
    <div class="rvs-result" data-rvs="result" hidden><span class="rvs-result-mark" aria-hidden="true">◇</span><h2 data-rvs="result-title"></h2><p data-rvs="result-score"></p><button data-rvs="new">もう一度、対戦する →</button></div>
    <div class="rvs-controls"><button data-rvs="undo">${undoIcon}<span>元に戻す</span></button><button data-rvs="hint">${icon('<path d="M9 18v-2a6 6 0 1 1 6 0v2Zm0 3h6"/>')}<span>おすすめの一手</span></button><button data-rvs="hints" aria-pressed="true">${icon('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/>')}<span>置ける場所 <small data-rvs="hint-mode">ON</small></span></button></div>
    <p class="rvs-tip">相手の石をはさめる場所にタップ。<br>四隅の石は、ひっくり返されません。</p><p class="rvs-save" data-rvs="save">この端末に自動保存</p>
  </section>`;
  const find=name=>container.querySelector(`[data-rvs="${name}"]`);
  const board=find('board');
  function save(){
    const data={...serializeGame(state),showHints};memory.set(KEY,data);
    try{localStorage.setItem(KEY,JSON.stringify(data));}
    catch{if(storageOK)notify('保存できませんでした。ゲーム室を閉じると進捗が失われる場合があります。');storageOK=false;}
    find('save').textContent=storageOK?'この端末に自動保存':'この画面内に保存中';
    onUpdate({id:'reversi',started:state.moves>0,completed:state.status==='finished'});
  }
  const cpuTurn=()=>state.mode==='cpu'&&state.turn!==state.human&&state.status==='playing';
  function render(){
    const count=scores(state.board),moves=legalMoves(state.board,state.turn),cpu=cpuTurn(),finished=state.status==='finished';
    find('mode').value=state.mode;find('difficulty').value=state.difficulty;
    find('difficulty-wrap').hidden=state.mode!=='cpu';
    find('black-label').textContent=state.mode==='cpu'?'あなた · 黒':'黒のプレイヤー';
    find('white-label').textContent=state.mode==='cpu'?'コンピューター · 白':'白のプレイヤー';
    find('black-score').textContent=count.black;find('white-score').textContent=count.white;
    find('ratio').style.width=`${count.black/(count.black+count.white)*100}%`;
    find('move-count').textContent=`${state.moves}手`;
    container.querySelectorAll('[data-player]').forEach(el=>el.classList.toggle('rvs-current',!finished&&Number(el.dataset.player)===state.turn));
    find('turn').classList.toggle('rvs-thinking',cpu);
    const pass=state.passed?`${names[state.passed]}は置ける場所がないためパス。` : '';
    find('turn').textContent=finished?'対局が終わりました。':`${pass}${cpu?'コンピューターが考えています…':state.mode==='cpu'?'あなた（黒）の番です。':`${names[state.turn]}の番です。`}`;
    board.setAttribute('aria-busy',String(cpu));
    board.innerHTML=state.board.map((stone,index)=>{
      const legal=moves.includes(index)&&!finished,available=legal&&!cpu;
      const contents=stone?`<span class="rvs-disc ${stone===1?'rvs-black':'rvs-white'} ${recentFlips.includes(index)?'rvs-flipped':''} ${index===state.lastMove?'rvs-placed':''}"></span>`:legal&&showHints?'<span class="rvs-legal-dot"></span>':'';
      const label=`${coordinates(index)}、${stone?`${names[stone]}の石`:available?`置けます、${flipsFor(state.board,index,state.turn).length}個返せます`:'空きマス'}`;
      return `<button type="button" role="gridcell" class="rvs-cell ${index===state.lastMove?'rvs-last':''} ${index===highlighted?'rvs-recommended':''} ${available?'rvs-available':''}" data-index="${index}" aria-label="${label}" aria-rowindex="${Math.floor(index/8)+1}" aria-colindex="${index%8+1}" aria-disabled="${!available}" tabindex="${index===focusIndex?0:-1}" ${cpu||finished?'disabled':''}>${contents}</button>`;
    }).join('');
    find('caption').textContent=finished?'おつかれさまでした。':cpu?'あなたは黒、コンピューターは白です。':`${moves.length}か所に置けます${showHints?' · 小さな丸が目印':''}`;
    find('empty-count').textContent=`空き ${count.empty}`;
    find('undo').disabled=!state.history.length;
    find('hint').disabled=cpu||finished;
    find('hints').setAttribute('aria-pressed',String(showHints));find('hint-mode').textContent=showHints?'ON':'OFF';
    find('result').hidden=!finished;
    if(finished){
      find('result-title').textContent=state.winner===0?'引き分けです。':state.mode==='cpu'?(state.winner===state.human?'あなたの勝ち！':'コンピューターの勝ち。'):`${names[state.winner]}の勝ち！`;
      find('result-score').textContent=`黒 ${count.black} 対 白 ${count.white}`;
    }
  }
  function cancelAI(){revision++;clearTimeout(aiTimer);aiTimer=null;}
  function scheduleAI(){
    cancelAI();if(!cpuTurn()||disposed)return;
    const version=revision;
    function run(){
      if(disposed||version!==revision||!cpuTurn())return;
      if(document.hidden||document.querySelector('dialog[open]')){aiTimer=setTimeout(run,200);return;}
      const move=chooseMove(state.board,state.turn,state.difficulty,{timeLimit:state.difficulty==='hard'?170:85,nodeLimit:25000});
      if(move!==null&&version===revision)makeMove(move);
    }
    aiTimer=setTimeout(run,300);
  }
  function makeMove(index){
    const flips=flipsFor(state.board,index,state.turn),result=playMove(state,index);
    if(!result.changed)return;
    state=result.state;highlighted=-1;recentFlips=flips;focusIndex=legalMoves(state.board,state.turn)[0]??index;
    save();render();scheduleAI();
  }
  function undo(){
    if(!state.history.length)return;
    cancelAI();state=undoMove(state).state;
    if(state.mode==='cpu')while(state.history.length&&state.turn!==state.human)state=undoMove(state).state;
    recentFlips=[];highlighted=-1;focusIndex=legalMoves(state.board,state.turn)[0]??0;
    save();render();scheduleAI();
  }
  function newGame(mode=state.mode){
    if(state.moves>0&&state.status==='playing'&&!confirm('今の対局を終了して、新しく始めますか？')){find('mode').value=state.mode;return;}
    cancelAI();state=createGame({mode,difficulty:state.difficulty,human:1});recentFlips=[];highlighted=-1;
    focusIndex=legalMoves(state.board,state.turn)[0]??0;save();render();scheduleAI();
  }
  function click(event){
    const button=event.target.closest('button');if(!button||!container.contains(button)||disposed)return;
    if(button.dataset.index!==undefined){
      if(cpuTurn()||state.status!=='playing')return;
      const index=Number(button.dataset.index);
      if(!flipsFor(state.board,index,state.turn).length){notify('相手の石をはさめる場所を選んでください');return;}
      makeMove(index);
    }else if(button.dataset.rvs==='undo')undo();
    else if(button.dataset.rvs==='new')newGame();
    else if(button.dataset.rvs==='hints'){showHints=!showHints;recentFlips=[];save();render();}
    else if(button.dataset.rvs==='hint'&&!cpuTurn()&&state.status==='playing'){
      highlighted=chooseMove(state.board,state.turn,'normal',{timeLimit:85,nodeLimit:12000});recentFlips=[];render();
      if(highlighted!==null){focusIndex=highlighted;board.querySelector(`[data-index="${highlighted}"]`)?.focus({preventScroll:true});notify(`${coordinates(highlighted)}に置くと、${flipsFor(state.board,highlighted,state.turn).length}個の石を返せます`);}
    }
  }
  function change(event){
    if(event.target.dataset.rvs==='mode')newGame(event.target.value);
    if(event.target.dataset.rvs==='difficulty'){state={...state,difficulty:event.target.value};save();render();scheduleAI();}
  }
  function key(event){
    const cell=event.target.closest('[data-index]');if(!cell||cpuTurn()||state.status!=='playing')return;
    const current=Number(cell.dataset.index),r=Math.floor(current/8),c=current%8;
    const next=event.key==='ArrowRight'?r*8+(c+1)%8:event.key==='ArrowLeft'?r*8+(c+7)%8:event.key==='ArrowUp'?(current+56)%64:event.key==='ArrowDown'?(current+8)%64:null;
    if(next!==null){event.preventDefault();focusIndex=next;board.querySelectorAll('[data-index]').forEach(el=>el.tabIndex=Number(el.dataset.index)===next?0:-1);board.querySelector(`[data-index="${next}"]`)?.focus();}
  }
  function visibility(){if(document.hidden)save();}
  container.addEventListener('click',click);container.addEventListener('change',change);board.addEventListener('keydown',key);
  document.addEventListener('visibilitychange',visibility);
  save();render();scheduleAI();
  return ()=>{if(disposed)return;cancelAI();save();disposed=true;container.removeEventListener('click',click);container.removeEventListener('change',change);board.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibility);};
}
