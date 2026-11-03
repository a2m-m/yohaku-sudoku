import { SUITS, rank, suit, isRed, label, createState, restoreState, serializeState, canMove, sourceCards, moveCard, drawCard, undoMove, restartDeal, suggestMove, autoFoundation } from './cards-engine.mjs';

const faces = ['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const formatTime = elapsed => `${String(Math.floor(elapsed / 60)).padStart(2,'0')}:${String(elapsed % 60).padStart(2,'0')}`;
const sameSource = (a,b) => a && b && a.type === b.type && a.index === b.index && a.offset === b.offset;
const volatileStore = new Map();

export function mount(container, { id = 'solitaire', notify = () => {}, onUpdate = () => {} } = {}) {
  const variant = id === 'freecell' ? 'freecell' : 'solitaire';
  const storageKey = `yohaku-games:v1:${variant}`;
  let state, selected = null, hintTarget = null, disposed = false, lastTick = performance.now(), fraction = 0, storageOK = true;
  try { state = restoreState(volatileStore.has(storageKey) ? volatileStore.get(storageKey) : JSON.parse(localStorage.getItem(storageKey)), variant); } catch {}
  state ||= createState(variant);
  container.classList.add('cds-mount');
  container.innerHTML = `<div class="cds-game ${variant === 'freecell' ? 'cds-freecell' : 'cds-solitaire'}">
    <div class="cds-toolbar"><div class="cds-metrics"><span><small>移動</small><strong data-moves>0</strong></span><span><small>完成</small><strong data-found>0/52</strong></span><span><small>タイム</small><strong data-time>00:00</strong></span></div><button type="button" class="cds-new" data-action="new">新しく配る <span aria-hidden="true">↻</span></button></div>
    <div class="cds-board" aria-label="${variant === 'freecell' ? 'フリーセル' : 'ソリティア'}のカード盤面"><div class="cds-top-labels"></div><div class="cds-top"></div><div class="cds-columns"></div></div>
    <div class="cds-message" role="status" aria-live="polite"></div>
    <div class="cds-controls"><button type="button" data-action="undo"><span aria-hidden="true">↶</span> 元に戻す</button><button type="button" data-action="hint"><span aria-hidden="true">✧</span> 次の一手</button><button type="button" data-action="auto"><span aria-hidden="true">↑</span> 自動で揃える</button><button type="button" data-action="retry"><span aria-hidden="true">↻</span> 同じ配札</button></div>
    <div class="cds-bottom"><span data-save>この端末に自動保存</span><span>${variant === 'freecell' ? '4つの空きマスを上手に使おう' : '1枚めくり・何度でもめくり直し'}</span></div>
    <div class="cds-win" hidden><div class="cds-win-symbol" aria-hidden="true">♧</div><h3>すべて、揃いました。</h3><p data-win-stats></p><button type="button" data-action="new">もう一度、遊ぶ →</button></div>
  </div>`;
  const find = selector => container.querySelector(selector);

  function save() {
    const saved = serializeState(state);
    volatileStore.set(storageKey, saved);
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
    catch { if (storageOK) notify('保存できませんでした。画面を閉じると進捗が失われる場合があります。'); storageOK = false; }
    find('[data-save]').textContent = storageOK ? 'この端末に自動保存' : 'この画面内でプレイ中';
  }

  function report() {
    onUpdate({ id: variant, started: state.moves > 0, completed: state.won, progress: state.foundations.reduce((n,p) => n + p.length, 0), moves: state.moves });
  }

  function sourceAttr(source) { return `data-source="${source.type}"${source.index !== undefined ? ` data-index="${source.index}"` : ''}${source.offset !== undefined ? ` data-offset="${source.offset}"` : ''}`; }
  function targetAttr(target) { return `data-target="${target.type}" data-pile="${target.index}"`; }
  function legalClass(target) { return selected && canMove(state, selected, target) ? ' cds-legal' : ''; }
  function hintClass(target) { return hintTarget && target.type === hintTarget.type && target.index === hintTarget.index ? ' cds-hint-target' : ''; }
  function cardHTML(cardId, source, { up = true, style = '', top = true, target = null } = {}) {
    const highlighted = sameSource(selected, source);
    const inSequence = selected?.type === 'tableau' && source.type === 'tableau' && selected.index === source.index && source.offset >= selected.offset;
    const targetClass = target ? legalClass(target) + hintClass(target) : '';
    if (!up) return `<div class="cds-card cds-facedown" style="${style}" aria-hidden="true"><span>▦</span></div>`;
    return `<button type="button" class="cds-card ${isRed(cardId) ? 'cds-red' : 'cds-black'} ${highlighted ? 'cds-selected' : ''} ${inSequence ? 'cds-in-sequence' : ''}${targetClass}" ${sourceAttr(source)} ${target ? targetAttr(target) : ''} style="${style}" aria-label="${label(cardId)}${source.type === 'tableau' ? `、${source.index + 1}列目` : source.type === 'foundation' ? '、完成の山' : source.type === 'cell' ? '、待避マス' : '、めくったカード'}${highlighted ? '、選択中' : ''}" aria-pressed="${Boolean(highlighted)}"><span class="cds-card-corner"><b>${faces[rank(cardId)]}</b><i>${SUITS[suit(cardId)]}</i></span><span class="cds-card-suit" aria-hidden="true">${SUITS[suit(cardId)]}</span><span class="cds-card-bottom" aria-hidden="true">${faces[rank(cardId)]}${SUITS[suit(cardId)]}</span>${!top ? '' : ''}</button>`;
  }
  function emptyHTML(target, content, aria) { return `<button type="button" class="cds-empty${legalClass(target)}${hintClass(target)}" ${targetAttr(target)} aria-label="${aria}">${content}</button>`; }
  function render() {
    find('[data-moves]').textContent = state.moves;
    find('[data-found]').textContent = `${state.foundations.reduce((n,p)=>n+p.length,0)}/52`;
    find('[data-time]').textContent = formatTime(state.elapsed);
    const foundations = state.foundations.map((pile,index) => pile.length ? cardHTML(pile.at(-1),{type:'foundation',index},{target:{type:'foundation',index}}) : emptyHTML({type:'foundation',index},`<span class="cds-empty-suit">${SUITS[index]}</span><small>A → K</small>`,`${SUITS[index]}の完成の山、Aから順に`)).join('');
    if (variant === 'solitaire') {
      find('.cds-top-labels').innerHTML='<span>山札</span><span>めくった札</span><span></span><span class="cds-found-label">完成の山 · Aから同じマークで</span>';
      const stock = `<button type="button" class="cds-stock ${state.stock.length ? 'cds-facedown' : 'cds-empty'}" data-action="draw" aria-label="${state.stock.length ? `山札を1枚めくる、残り${state.stock.length}枚` : state.waste.length ? '山札をめくり直す' : '山札なし'}" ${!state.stock.length && !state.waste.length ? 'disabled' : ''}><span aria-hidden="true">${state.stock.length ? '▦' : '↻'}</span><small>${state.stock.length || 'もう一度'}</small></button>`;
      const waste = state.waste.length ? cardHTML(state.waste.at(-1),{type:'waste'}) : '<div class="cds-empty cds-waste-placeholder" aria-label="めくった札の置き場"></div>';
      find('.cds-top').innerHTML=`${stock}${waste}<span class="cds-top-spacer"></span>${foundations}`;
    } else {
      find('.cds-top-labels').innerHTML='<span class="cds-cell-label">待避マス · 1枚ずつ置けます</span><span class="cds-found-label">完成の山 · Aから同じマークで</span>';
      find('.cds-top').innerHTML=state.cells.map((cardId,index)=>cardId !== null ? cardHTML(cardId,{type:'cell',index},{target:{type:'cell',index}}) : emptyHTML({type:'cell',index},'<span>·</span>',`待避マス${index+1}、空き`)).join('') + foundations;
    }
    find('.cds-columns').innerHTML=state.tableau.map((pile,index)=>{
      const step = variant === 'freecell' ? 32 : 31;
      const totalStep = pile.reduce((total,c,i)=>total + (i < pile.length-1 ? (c.up ? step : 15) : 0),0);
      let offset = 0;
      const contents = pile.map((c,position)=>{
        const html=cardHTML(c.id,{type:'tableau',index,offset:position},{up:c.up,style:`--cds-top:${offset}px`,top:position===pile.length-1,target:position===pile.length-1 ? {type:'tableau',index} : null});
        offset += c.up ? step : 15;return html;
      }).join('');
      return `<div class="cds-column" style="--cds-stack:${totalStep}px">${emptyHTML({type:'tableau',index},`<span>${variant === 'solitaire' ? 'K' : '+'}</span>`,`${index+1}列目、${pile.length ? 'カードの下の移動先' : '空き列'}`)}${contents}</div>`;
    }).join('');
    find('[data-action="undo"]').disabled=!state.history.length;
    find('[data-action="auto"]').disabled=state.won;
    find('[data-action="hint"]').disabled=state.won;
    const message = find('.cds-message');
    if(state.won) message.textContent='52枚すべてを完成の山に揃えました。おめでとうございます！';
    else if(selected) { const ids=sourceCards(state,selected); message.textContent=`${ids.length>1 ? `${ids.length}枚の並び` : label(ids[0])}を選択中。光っている移動先をタップ。`; }
    else message.textContent=variant==='freecell'?'カードをタップ → 移動先をタップ。赤黒交互に、大きい数字の下へ。':'カードをタップ → 移動先をタップ。動かせないときは山札をめくってみよう。';
    find('.cds-win').hidden=!state.won;
    find('[data-win-stats]').textContent=`${state.moves}手 · ${formatTime(state.elapsed)} でクリア`;
  }

  function apply(next, message) {
    if(next===state) return false;
    state=next;selected=null;hintTarget=null;save();render();report();
    if(message)notify(message);
    if(state.won)notify('クリア！52枚すべてが揃いました。');
    return true;
  }
  function readSource(button) {
    if(!button.dataset.source) return null;
    const source={type:button.dataset.source};
    if(button.dataset.index!==undefined)source.index=Number(button.dataset.index);
    if(button.dataset.offset!==undefined)source.offset=Number(button.dataset.offset);
    return source;
  }
  function click(event) {
    const button=event.target.closest('button');if(!button||!container.contains(button)||button.disabled)return;
    const action=button.dataset.action;
    if(action==='draw'){apply(drawCard(state));return;}
    if(action==='undo'){apply(undoMove(state));return;}
    if(action==='retry'){
      if(state.moves && !confirm('この配札を最初からやり直しますか？'))return;
      state=restartDeal(state);selected=null;hintTarget=null;fraction=0;lastTick=performance.now();save();render();report();return;
    }
    if(action==='new'){
      if(state.moves && !state.won && !confirm('現在の途中経過を置き換えて、新しいカードを配りますか？'))return;
      state=createState(variant);selected=null;hintTarget=null;fraction=0;lastTick=performance.now();save();render();report();return;
    }
    if(action==='auto'){
      if(!apply(autoFoundation(state)))notify('今は安全に自動で送れるカードがありません。Aから順に集めましょう。');
      return;
    }
    if(action==='hint'){
      const suggestion=suggestMove(state);
      if(suggestion){selected=suggestion.source;hintTarget=suggestion.target;render();const to=suggestion.target.type==='foundation'?'上の完成の山':suggestion.target.type==='cell'?`${suggestion.target.index+1}番目の待避マス`:`${suggestion.target.index+1}列目`;notify(`${label(sourceCards(state,selected)[0])}を${to}へ移動できます`);}
      else if(variant==='solitaire'&&(state.stock.length||state.waste.length)){selected=null;hintTarget=null;render();notify('左上の山札をめくって、別のカードを探してみよう');}
      else notify('今は動かせるカードがありません。元に戻すか、同じ配札をやり直せます。');
      return;
    }
    if(state.won)return;
    const source=readSource(button),target=button.dataset.target?{type:button.dataset.target,index:Number(button.dataset.pile)}:null;
    if(selected&&target&&canMove(state,selected,target)){apply(moveCard(state,selected,target));return;}
    if(source){
      if(sameSource(selected,source)){selected=null;hintTarget=null;render();return;}
      const sequence=sourceCards(state,source);
      if(sequence.length){selected=source;hintTarget=null;render();}
      else notify('その並びはまとめて動かせません。赤黒交互・数字が1ずつ小さくなる並びを選んでください。');
    }else if(target&&selected){notify(variant==='freecell'?'そこには置けません。赤黒交互・数字の順、空きマスの数を確認してください。':'そこには置けません。赤黒交互で1つ大きい数字の下へ。空き列はKからです。');}
  }
  container.addEventListener('click',click);
  function tick(){
    const now=performance.now();
    if(!disposed&&state.moves>0&&!state.won&&!document.hidden&&!document.querySelector('dialog[open]')){
      fraction+=now-lastTick;
      if(fraction>=1000){const delta=Math.floor(fraction/1000);state.elapsed+=delta;fraction-=delta*1000;find('[data-time]').textContent=formatTime(state.elapsed);if(state.elapsed%5===0)save();}
    }
    lastTick=now;
  }
  const timer=setInterval(tick,250);
  const visibility=()=>{lastTick=performance.now();if(document.hidden)save();};
  const pagehide=()=>{tick();save();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pagehide);
  render();save();report();
  return ()=>{tick();save();disposed=true;clearInterval(timer);container.removeEventListener('click',click);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);container.classList.remove('cds-mount');};
}
