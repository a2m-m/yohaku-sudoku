import { create2048, move2048, undo2048, createFifteen, moveFifteen, moveFifteenBlank, undoFifteen, restoreNumberGame, fifteenNeighbors } from './numbers-engine.mjs';

const keyFor = id => `yohaku-games:v1:${id}`;
const arrows = { left: '←', up: '↑', down: '↓', right: '→' };
const directionNames = { left: '左', up: '上', down: '下', right: '右' };
const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const volatileStore = new Map();
const read = (key, fallback) => { if (volatileStore.has(key)) return volatileStore.get(key); try { const text = localStorage.getItem(key); return text === null ? fallback : JSON.parse(text); } catch { return fallback; } };

export function mount(container, { id = '2048', notify = () => {}, onUpdate = () => {} } = {}) {
  const is2048 = id === '2048';
  let state = restoreNumberGame(id, read(keyFor(id), null));
  let best = read(`${keyFor(id)}:best`, 0);
  if (!Number.isSafeInteger(best) || best < 0) best = 0;
  best = Math.max(best, is2048 ? state.score : 0);
  let disposed = false, storageWarned = false, lastTime = performance.now(), millis = 0;
  let lastSaved = state.elapsed || 0, pointerStart = null, lastGain = 0;

  container.innerHTML = `<section class="num-game ${is2048 ? 'num-2048' : 'num-fifteen'}" aria-label="${is2048 ? '2048' : '15パズル'}のゲーム盤">
    <div class="num-toolbar">
      <div class="num-metrics"><div class="num-metric"><span>${is2048 ? 'スコア' : '手数'}</span><strong data-num="primary">0</strong></div><div class="num-metric"><span>${is2048 ? 'ベスト' : 'タイム'}</span><strong data-num="secondary">0</strong></div></div>
      <div class="num-actions"><button type="button" class="num-action" data-num="undo" aria-label="一手戻す"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3"/></svg><span>戻す</span></button><button type="button" class="num-new" data-num="new">新しいゲーム</button></div>
    </div>
    <div class="num-announcement" data-num="announcement" role="status" aria-live="polite" hidden></div>
    <div class="num-board" data-num="board" role="grid" tabindex="0" aria-label="${is2048 ? '4行4列の2048盤面。矢印キーまたはスワイプで数字を動かせます' : '4行4列の15パズル。空きマスの隣の数字をタップして移動'}"></div>
    <div class="num-board-caption"><span data-num="caption">${is2048 ? '同じ数字を合わせて、2048を目指そう。' : '1〜15の順に並べて、右下を空けよう。'}</span><span class="num-gain" data-num="gain"></span></div>
    ${is2048 ? `<div class="num-directions" aria-label="数字を動かす方向">${Object.entries(arrows).map(([direction, symbol]) => `<button type="button" data-direction="${direction}" aria-label="数字を${directionNames[direction]}へ動かす">${symbol}</button>`).join('')}</div><p class="num-tip">スワイプ・矢印キーでも操作できます</p>` : '<p class="num-tip">空きマスの隣をタップ。矢印キーで空きマスを移動できます。</p>'}
    <div class="num-save-note" data-num="save"><i></i>この端末に自動保存</div>
  </section>`;
  const find = name => container.querySelector(`[data-num="${name}"]`);
  const boardElement = find('board');

  function persist(changed = false) {
    const saved = { ...state, board: state.board.slice(), history: state.history.slice(-40), version: 1 };
    volatileStore.set(keyFor(id), saved);
    if (is2048) volatileStore.set(`${keyFor(id)}:best`, best);
    try {
      localStorage.setItem(keyFor(id), JSON.stringify(saved));
      if (is2048) localStorage.setItem(`${keyFor(id)}:best`, JSON.stringify(best));
    } catch {
      find('save').textContent = 'この画面内に保存中';
      if (!storageWarned) { storageWarned = true; notify('端末に保存できませんでした。この画面を閉じると進捗が失われる場合があります。'); }
    }
    if (changed) onUpdate({ id, moves: state.moves, score: state.score || 0, completed: is2048 ? state.won : state.completed });
  }

  function render() {
    find('primary').textContent = (is2048 ? state.score : state.moves).toLocaleString('ja-JP');
    find('secondary').textContent = is2048 ? best.toLocaleString('ja-JP') : time(state.elapsed);
    find('undo').disabled = !state.history.length;
    const announcement = find('announcement');
    const message = is2048 ? state.over ? '動かせるマスがなくなりました。「戻す」で一手前に戻るか、新しいゲームへ。' : state.won ? '2048達成！ このまま、もっと大きな数字も目指せます。' : '' : state.completed ? `完成！ ${state.moves}手・${time(state.elapsed)}で、きれいに揃いました。` : '';
    announcement.hidden = !message; announcement.textContent = message;
    const adjacent = is2048 ? [] : fifteenNeighbors(state.board.indexOf(0));
    boardElement.innerHTML = state.board.map((n, index) => {
      const row = Math.floor(index / 4) + 1, col = index % 4 + 1;
      if (is2048) {
        const shade = n ? Math.min(11, Math.log2(n)) : 0;
        return `<div role="gridcell" aria-label="${row}行${col}列、${n || '空きマス'}" class="num-tile num-value-${shade} ${index === state.spawned ? 'num-spawn' : ''} ${state.merged.includes(index) ? 'num-merge' : ''}" data-value="${n}">${n || ''}</div>`;
      }
      return n ? `<button type="button" role="gridcell" class="num-tile num-fifteen-tile ${adjacent.includes(index) && !state.completed ? 'num-movable' : ''} ${index === state.moved ? 'num-slide' : ''}" data-index="${index}" aria-label="${n}、${row}行${col}列${adjacent.includes(index) && !state.completed ? '、タップで移動' : ''}" aria-disabled="${state.completed || !adjacent.includes(index)}">${n}</button>` : `<div class="num-tile num-empty" role="gridcell" aria-label="${row}行${col}列、空きマス"></div>`;
    }).join('');
    find('gain').textContent = lastGain > 0 ? `+${lastGain}` : '';
  }

  function apply(result) {
    if (!result.changed) return;
    const beforeWon = is2048 ? state.won : state.completed;
    state = result.state; lastGain = result.gained || 0;
    if (is2048) best = Math.max(best, state.score);
    persist(true); render();
    if (!beforeWon && (is2048 ? state.won : state.completed)) notify(is2048 ? '2048達成！ おめでとうございます。' : '15パズル完成！ おつかれさまでした。');
  }

  function move(direction) {
    if (disposed) return;
    apply(is2048 ? move2048(state, direction) : moveFifteenBlank(state, direction));
  }

  function click(event) {
    const button = event.target.closest('button');
    if (!button || !container.contains(button)) return;
    if (button.dataset.num === 'undo') apply(is2048 ? undo2048(state) : undoFifteen(state));
    else if (button.dataset.num === 'new') {
      if (state.moves > 0 && !(is2048 ? state.over : state.completed) && !confirm('今の途中経過をリセットして、新しいゲームを始めますか？')) return;
      state = is2048 ? create2048() : createFifteen(); lastGain = 0; millis = 0; lastTime = performance.now(); lastSaved = 0;
      persist(true); render();
    } else if (button.dataset.direction) move(button.dataset.direction);
    else if (button.dataset.index !== undefined && !is2048) { apply(moveFifteen(state, Number(button.dataset.index))); boardElement.focus({ preventScroll: true }); }
  }

  function keydown(event) {
    if (disposed || event.target.closest?.('input,textarea,select') || document.querySelector('dialog[open]') || event.altKey) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); apply(is2048 ? undo2048(state) : undoFifteen(state)); return; }
    if (event.ctrlKey || event.metaKey) return;
    const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
    if (direction) { event.preventDefault(); move(direction); }
  }

  function pointerdown(event) {
    if (!is2048 || !event.isPrimary || event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    boardElement.setPointerCapture(event.pointerId);
  }
  function pointerup(event) {
    if (!pointerStart || event.pointerId !== pointerStart.id) return;
    const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
  }
  function cancelPointer() { pointerStart = null; }

  function tick() {
    const now = performance.now();
    if (!is2048 && !state.completed && !document.hidden && !document.querySelector('dialog[open]')) {
      millis += now - lastTime;
      if (millis >= 1000) { const seconds = Math.floor(millis / 1000); state.elapsed += seconds; millis -= seconds * 1000; find('secondary').textContent = time(state.elapsed); }
      if (state.elapsed - lastSaved >= 5) { persist(); lastSaved = state.elapsed; }
    }
    lastTime = now;
  }
  function visibility() { lastTime = performance.now(); if (document.hidden) persist(); }
  function pagehide() { tick(); persist(); }

  container.addEventListener('click', click);
  document.addEventListener('keydown', keydown);
  boardElement.addEventListener('pointerdown', pointerdown);
  boardElement.addEventListener('pointerup', pointerup);
  boardElement.addEventListener('pointercancel', cancelPointer);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pagehide);
  const clock = setInterval(tick, 250);
  render(); persist();
  return () => {
    tick(); persist(); disposed = true; clearInterval(clock);
    container.removeEventListener('click', click);
    document.removeEventListener('keydown', keydown);
    boardElement.removeEventListener('pointerdown', pointerdown);
    boardElement.removeEventListener('pointerup', pointerup);
    boardElement.removeEventListener('pointercancel', cancelPointer);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', pagehide);
  };
}
