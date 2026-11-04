const $=id=>document.getElementById(id);
const games=[
  {id:'nonogram',name:'お絵描きロジック',en:'NONOGRAM',category:'puzzle',description:'数字の先に、ちいさな絵が見える。',skill:'5×5・10×10の絵解きパズル',tag:'NEW · 塗って、ひらめく',oneLine:'縦横の数字をヒントにマスを塗って、隠れた絵を完成させよう。',goal:'数字のヒントから塗る場所を見つけて、1枚の絵を完成させよう。',steps:['縦横の数字は、連続して塗るマスの数です。「3 1」なら3マスと1マスを、その順で間に1マス以上空けて塗ります。','「塗る」「×を付ける」「消す」のモードを選んでマスをタップ。塗らないとわかった場所には×を付けると、考えを整理できます。','正しいマスをすべて塗れば完成です。塗らないマスをすべて×にする必要はありません。','迷ったらヒントで1マス教えてもらえます。間違えても何度でも修正でき、「元に戻す」も使えます。'],tip:'まずは5×5から。数字の合計と隙間を数えると、端から端まで決まる行や列が見つかることがあります。'},
  {id:'wood',name:'ウッドパズル',en:'WOOD BLOCK PUZZLE',category:'puzzle',description:'はめて、そろえて、すっきりと。',skill:'時間制限なしのブロックパズル',tag:'NEW · 木のブロックを、ひとつずつ',oneLine:'縦・横・3×3を埋めて消す。木のブロックを上手にはめよう。',goal:'9×9の盤面にブロックを置き、列や区画を消しながらハイスコアを目指そう。',steps:['下にある3つのブロックから1つを選び、ブロックの左上を置きたいマスをタップ。ドラッグして置くこともできます。','縦1列・横1列・3×3の区画がすべて埋まると、ブロックが消えます。同時にいくつも消すことができます。','手持ちの3つを使い切ると、新しい3つが現れます。ブロックは回転できません。','手持ちのどのブロックも置けなくなったらゲーム終了。「元に戻す」で直前の配置をやり直すこともできます。'],tip:'時間制限はありません。大きいブロックを置ける空間を残しながら、あせらず考えてみましょう。'},
  {id:'reversi',name:'オセロ',en:'REVERSI',category:'board',description:'はさんで返す、白と黒の駆け引き。',skill:'コンピューター対戦・2人対戦',tag:'白と黒の定番',oneLine:'相手の石をはさんで、自分の色に。最後に石が多いほうの勝ち。',goal:'タテ・ヨコ・ナナメで相手の石をはさんで返し、最後に自分の石を多くしよう。',steps:['黒が先手です。自分の石と新しく置く石で、相手の石を1個以上はさめるマスに置きます。小さな丸が、置ける場所の目印です。','はさんだ石は、すべて自分の色にひっくり返ります。一手で複数の方向にはさむこともできます。','置ける場所がない場合は自動でパス。両者とも置けなくなったら終了し、盤面の石が多いほうが勝ちです。同じ数なら引き分けです。','コンピューター対戦では、あなたは黒。強さは3段階から選べます。「2人で対戦」では、同じ画面で黒と白を交互に操作します。'],tip:'迷ったら「おすすめの一手」をどうぞ。コンピューター対戦の「元に戻す」は、あなたが打つ前まで戻せます。四隅を取ると、その石は返されません。'},
  {id:'mines',name:'マインスイーパー',en:'MINESWEEPER',category:'puzzle',description:'数字を頼りに、地雷を見つける。',skill:'はじめてでも、少しずつ',tag:'昔のPCの、あのゲーム',oneLine:'数字は、周り8マスの地雷の数。地雷のないマスをすべて開こう。',goal:'地雷を踏まずに、安全なマスをすべて開けばクリア。',steps:['まずは、好きなマスをタップ。最初のマスとその周りには地雷がありません。','数字は、周囲8マスにある地雷の数。「1」なら、その周りのどこかに地雷が1個あります。','地雷の場所がわかったら「旗を立てる」に切り替えて印を付けます。安全な場所を開くときは「開く」に戻しましょう。','数字の周りに同じ数の旗を置いたら、その数字をタップすると残りの周囲をまとめて開けます。旗の場所が違うと地雷を踏むので慎重に。'],tip:'初級からがおすすめ。パソコンでは右クリックでも旗を置けます。地雷を踏んでも何度でも挑戦できます。'},
  {id:'sudoku',name:'数独',en:'SUDOKU',category:'puzzle',description:'ひとマスずつ、数字を揃える。',skill:'難易度5〜10 · 全100問',tag:'100問のコレクション'},
  {id:'solitaire',name:'ソリティア',en:'KLONDIKE SOLITAIRE',category:'cards',description:'赤と黒を重ねて、すっきりと。',skill:'定番の1枚めくり',tag:'おなじみの、ひとりトランプ',oneLine:'場では赤と黒を交互に、KからAへ。上の組には同じマークでAからKへ。',goal:'4つのマークごとに、A → 2 → … → Kの順で全52枚を揃えよう。',steps:['左上の山札をタップすると、カードを1枚めくれます。山札がなくなったら、もう一度タップしてめくり直せます。','場のカードを選んで、移動先をタップ。赤・黒が交互で、数字が1つ小さいカードを重ねられます。例：黒の7の上に赤の6。','並んだカードはまとめて移動できます。場の空いた列に置けるのはKから始まる並びだけです。','Aが出たら上の組へ。同じマークでAから順に重ねます。「自動で揃える」で移動できるカードを上に送れます。'],tip:'動かすカード → 移動先の順にタップ。ドラッグしなくて大丈夫です。「ヒント」と「元に戻す」も使えます。配札によってはクリアできないこともあります。'},
  {id:'freecell',name:'フリーセル',en:'FREECELL',category:'cards',description:'4つの空きを、うまく使って。',skill:'先を読む、カードパズル',tag:'じっくり考えるなら',oneLine:'4つの一時置き場を使って、同じマークのカードをAからKまで揃えよう。',goal:'全52枚を、右上の4つの組にマークごとにA → Kの順で集めよう。',steps:['カードを選んでから、移動先をタップ。場では赤・黒を交互に、1つ小さい数字を重ねます。例：赤の9の上に黒の8。','左上の4つのフリーセルには、カードを1枚ずつ一時的に置けます。必要なカードを取り出すために使いましょう。','空いた場の列には、どのカードでも置けます。空きフリーセルや空き列が多いほど、まとめて動かせる枚数が増えます。','Aが出たら右上の組へ。同じマークで1つずつ大きく重ねます。「自動で揃える」で上の組への移動をまとめて行えます。'],tip:'すべてのカードが最初から見えています。フリーセルを埋めすぎず、空き列を作るのがコツ。配札のクリア可能性を保証するものではありません。'},
  {id:'fifteen',name:'15パズル',en:'FIFTEEN PUZZLE',category:'puzzle',description:'ひとつの空きから、順番に。',skill:'1〜15をきれいに整列',tag:'シンプルだけど、奥深い',oneLine:'空きマスの隣をタップ。1から15まで順番に並べよう。',goal:'左上から1〜15を順番に並べ、右下を空きマスにすればクリア。',steps:['空きマスの上下左右にある数字をタップすると、その数字が空きマスへ滑ります。','斜めの数字や、離れた数字は動かせません。空きを動かしながら、少しずつ数字を揃えます。','上の段、左の列から整えるのがコツ。迷ったら「元に戻す」で一手前に戻れます。'],tip:'パソコンでは矢印キーも使えます。すべての初期配置は、完成できるようにシャッフルしています。'},
  {id:'2048',name:'2048',en:'2048',category:'puzzle',description:'同じ数字を合わせて、大きく。',skill:'スワイプで、ひらめきを',tag:'つい、もう一回',oneLine:'同じ数字をくっつけて、2048を目指そう。スワイプか矢印で操作。',goal:'2と2で4、4と4で8。同じ数字を重ねて2048のタイルを作ろう。',steps:['盤面を上下左右にスワイプすると、すべてのタイルがその方向に動きます。下の矢印ボタンでも操作できます。','同じ数字どうしがぶつかると、ひとつに合体。1回の操作では、できたばかりのタイルはもう合体しません。','動かすたびに、新しい2または4が現れます。盤面が埋まって動かせなくなるとゲーム終了です。','2048を作れば目標達成。そのまま、もっと大きな数字にも挑戦できます。'],tip:'大きい数字をひとつの隅に集めるのがコツ。パソコンでは矢印キー。「元に戻す」で直前の一手をやり直せます。'}
];
const href=game=>game.id==='sudoku'?'./sudoku.html':`#${game.id}`;
function preview(id){
  if(id==='nonogram')return `<div class="preview-nonogram"><div class="pn-top" aria-hidden="true"><b>2</b><b>4</b><b>4</b><b>4</b><b>2</b></div><div class="pn-side" aria-hidden="true"><b>1 1</b><b>5</b><b>5</b><b>3</b><b>1</b></div><div class="pn-grid">${Array.from('0101011111111110111000100',(v,i)=>`<span class="${v==='1'?'pn-fill':''} ${[3,11,13,18].includes(i)?'pn-soft':''}"></span>`).join('')}</div></div>`;
  if(id==='wood')return `<div class="preview-wood"><div class="pw-grid">${Array.from({length:36},(_,i)=>`<span class="${[18,19,20,24,25,26,27,30,31,32,33,34,35].includes(i)?'pw-filled':''}"></span>`).join('')}</div><div class="pw-piece"><i></i><i></i><i></i><i></i></div></div>`;
  if(id==='reversi')return `<div class="preview-reversi">${Array.from({length:64},(_,i)=>`<span>${[28,35].includes(i)?'<i class="pr-black"></i>':[27,36].includes(i)?'<i class="pr-white"></i>':[19,26,37,44].includes(i)?'<b></b>':''}</span>`).join('')}</div>`;
  if(id==='mines')return `<div class="preview-mines">${['','',1,'','','','','',1,2,1,'','','','',1,'⚑',1,'','','','',1,1,1,'','','','','','','','','',''].map(v=>`<span class="${v?'open':''} ${v===2?'two':''} ${v==='⚑'?'flag':''}">${v}</span>`).join('')}</div>`;
  if(id==='sudoku'){const values='090108000004000006000060000000084050000070862009000300201540000700000004006003007';return `<div class="preview-sudoku">${Array.from(values,(v,i)=>`<span class="${[4,13,22,31,40,49,58,67,76].includes(i)?'p-highlight':''}">${v==='0'?'':v}</span>`).join('')}</div>`;}
  if(id==='solitaire')return '<div class="preview-cards"><div class="preview-card pc-1 c-green">K<small>♠</small><span>♠</span></div><div class="preview-card pc-2 c-red">Q<small>♥</small><span>♥</span></div><div class="preview-card pc-3 c-green">J<small>♣</small><span>♣</span></div></div>';
  if(id==='freecell')return '<div class="preview-cards preview-freecell"><div class="preview-card pc-1 c-green">A<small>♠</small><span>♠</span></div><div class="preview-card pc-2 c-red">A<small>♥</small><span>♥</span></div><div class="preview-card pc-3 c-green">A<small>♣</small><span>♣</span></div><div class="preview-card pc-4 c-red">A<small>♦</small><span>♦</span></div></div>';
  if(id==='fifteen')return `<div class="preview-fifteen">${[1,2,3,4,5,6,7,8,9,10,11,12,13,'',14,15].map(v=>`<span class="${v?'':'empty'}">${v}</span>`).join('')}</div>`;
  return `<div class="preview-2048">${[2,4,'','',4,8,2,'',8,16,4,'',128,32,8,2].map(v=>`<span class="${v?`v${v}`:'empty'}">${v}</span>`).join('')}</div>`;
}
let category='all',current=null,cleanup=null,routeSequence=0,toastTimer;
const fallbackStorage=new Map();
function read(key,fallback){if(fallbackStorage.has(key))return fallbackStorage.get(key);try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback;}catch{return fallback;}}
function write(key,value){fallbackStorage.set(key,value);try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
function toast(message){$('room-toast').textContent=message;$('room-toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('room-toast').classList.remove('visible'),3500);}
function renderHome(){
  $('game-total').textContent=String(games.length).padStart(2,'0');
  $('game-filter-total').textContent=games.length;
  const visible=games.filter(g=>category==='all'||g.category===category);
  $('game-grid').innerHTML=visible.map((game,i)=>`<a href="${href(game)}" class="room-game-card" data-game="${game.id}" style="--delay:${i*40}ms" aria-label="${game.name}で遊ぶ"><div class="room-card-preview" aria-hidden="true"><span class="room-card-tag">${game.tag}</span>${preview(game.id)}</div><div class="room-card-body"><span class="room-card-category">${game.en}</span><div class="room-card-title-line"><h2>${game.name}</h2><span class="room-card-arrow" aria-hidden="true">↗</span></div><p>${game.description}</p><span class="room-card-skill"><i></i>${game.skill}</span></div></a>`).join('');
  $('game-count').textContent=`${visible.length}つの定番ゲーム`;
  $('game-filters').querySelectorAll('button').forEach(button=>{button.classList.toggle('active',button.dataset.filter===category);button.setAttribute('aria-pressed',String(button.dataset.filter===category));});
  const recent=read('yohaku-games:last',null),game=games.find(g=>g.id===recent?.id);
  $('recent-game').hidden=!game;
  if(game){$('recent-title').textContent=`${game.name}を開く`;$('recent-game').href=href(game);}
}
function showRules(game){
  $('dialog-eyebrow').textContent='HOW TO PLAY';$('dialog-title').textContent=`${game.name}の遊び方`;
  $('dialog-content').innerHTML=`<p class="room-rule-goal">${game.goal}</p>${game.id==='2048'?'<div class="room-rule-example" aria-hidden="true"><span>2</span><span>2</span><span>→</span><span>4</span></div>':''}<ol class="room-rule-list">${game.steps.map(step=>`<li>${step}</li>`).join('')}</ol><p class="room-rule-tip">${game.tip}</p>`;
  $('dialog-done').textContent='わかった、遊んでみる';
  if(!$('room-dialog').open)$('room-dialog').showModal();
  write(`yohaku-games:help-seen:${game.id}`,true);
}
function showAbout(){
  $('dialog-eyebrow').textContent='ABOUT THIS LITTLE ROOM';$('dialog-title').textContent='余白のゲーム室';
  $('dialog-content').innerHTML='<div class="room-about-copy"><p>昔のPCで、気づけば遊んでいた定番たち。広告も会員登録もなく、スマホでもパソコンでも遊べます。</p><p>どのゲームにも遊び方を用意しています。初めてのゲームも、気負わず一手から。</p><p>進捗は端末・ブラウザごとに保存されます。端末間の同期はありません。ブラウザのサイトデータを消すと進捗も消えます。</p><p>一度読み込んでオフライン用の準備が完了すれば、通信のない場所でも遊べます。iPhoneはSafariの「共有 → ホーム画面に追加」で、すぐ開けるようになります。</p></div>';
  $('dialog-done').textContent='ゲームにもどる';if(!$('room-dialog').open)$('room-dialog').showModal();
}
async function route(){
  const sequence=++routeSequence;
  if(cleanup){cleanup();cleanup=null;}
  $('room-dialog').close();
  const id=location.hash.slice(1),game=games.find(g=>g.id===id&&g.id!=='sudoku');
  current=game||null;
  $('home-view').hidden=Boolean(game);$('game-view').hidden=!game;
  if(!game){document.title='余白のゲーム室 — いつものゲーム、あなたのペースで。';renderHome();return;}
  document.title=`${game.name} — 余白のゲーム室`;
  $('game-view').classList.toggle('wide-game',game.category==='cards');
  $('game-category').textContent=game.en;
  $('game-title').textContent=game.name;
  $('game-number').textContent=`${String(games.indexOf(game)+1).padStart(2,'0')} / ${String(games.length).padStart(2,'0')}`;
  $('game-one-line').textContent=game.oneLine;
  $('game-container').innerHTML='<p class="room-loading" role="status">ゲームを準備しています…</p>';
  write('yohaku-games:last',{id:game.id,playedAt:Date.now()});
  try{
    const module=await(game.id==='nonogram'?import('../games/nonogram.mjs'):game.id==='wood'?import('../games/wood.mjs'):game.id==='reversi'?import('../games/reversi.mjs'):game.id==='mines'?import('../games/mines.mjs'):game.category==='cards'?import('../games/cards.mjs'):import('../games/numbers.mjs'));
    if(sequence!==routeSequence)return;
    $('game-container').replaceChildren();
    cleanup=module.mount($('game-container'),{id:game.id,notify:toast,onUpdate:()=>{}});
    if(!read(`yohaku-games:help-seen:${game.id}`,false))showRules(game);
  }catch(error){
    if(sequence!==routeSequence)return;
    console.error(error);$('game-container').innerHTML='<p class="room-error">ゲームを読み込めませんでした。<br>接続を確認して再読み込みしてください。<br><a href="#">ゲーム一覧にもどる</a></p>';
  }
  window.scrollTo({top:0,behavior:'auto'});
}
$('game-filters').addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(button){category=button.dataset.filter;renderHome();}});
$('game-grid').addEventListener('click',event=>{const link=event.target.closest('[data-game]');if(link?.dataset.game==='sudoku')write('yohaku-games:last',{id:'sudoku',playedAt:Date.now()});});
$('rules-button').addEventListener('click',()=>{if(current)showRules(current);});
$('about-button').addEventListener('click',showAbout);
for(const id of ['dialog-close','dialog-done'])$(id).addEventListener('click',()=>$('room-dialog').close());
$('room-dialog').addEventListener('click',event=>{const r=$('room-dialog').getBoundingClientRect();if(event.target===$('room-dialog')&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))$('room-dialog').close();});
window.addEventListener('hashchange',route);
window.addEventListener('pagehide',()=>{if(cleanup)cleanup();});
window.addEventListener('pageshow',event=>{if(event.persisted)route();});
if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});
route();
