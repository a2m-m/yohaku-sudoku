import {PUZZLES} from './lights-puzzles.mjs';
import {createGame, press, undo, serializeGame, solveLights} from './lights-engine.mjs';

const PREFIX = 'yohaku-games:v1:lights:';
const memory = new Map();
function read(key, fallback = null) { if (memory.has(key)) return memory.get(key); try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } }
const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const icons = {
  undo: '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3"/>',
  hint: '<path d="M9 18v-2a6 6 0 1 1 6 0v2Zm0 3h6"/>',
  restart: '<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;

export function mount(container, {notify = () => {}, onUpdate = () => {}} = {}) {
  let puzzle = PUZZLES.find(p => p.id === read(PREFIX + 'current')) || PUZZLES[0];
  let game = createGame(puzzle, read(PREFIX + puzzle.id)), focused = 0, suggested = -1;
  let disposed = false, storageOK = true, filter = 0, progressFilter = 'all', page = 0, book = {};
  let last = performance.now(), fraction = 0, lastSaved = -1;
  const pageSize = 24;
  container.innerHTML = `<section class="lgo-game" aria-label="ライトアウトのゲーム">
    <div class="lgo-toolbar"><button data-light="library" class="lgo-picker">No. <strong data-light="number"></strong><small data-light="size"></small><span aria-hidden="true">⌄</span></button><span class="lgo-time" data-light="time">00:00</span></div>
    <div class="lgo-board" data-light="board" role="grid" aria-label="ライトアウトの盤面"></div>
    <div class="lgo-caption"><span data-light="lit"></span><span><strong data-light="moves">0</strong> 手 <i aria-hidden="true">·</i> 目安 <span data-light="par"></span>手</span></div>
    <p class="lgo-status" data-light="status" role="status">明かりをタップして、すべて消そう。</p>
    <div class="lgo-actions"><button data-light="undo">${icon('undo')}<span>元に戻す</span></button><button data-light="hint">${icon('hint')}<span>次の一手</span></button><button data-light="restart">${icon('restart')}<span>最初から</span></button></div>
    <div class="lgo-completion" data-light="completion" hidden><span>ALL LIGHTS OUT</span><h2>すっきり、消えました。</h2><p data-light="clear-stats"></p><button data-light="next">次の問題へ →</button></div>
    <p class="lgo-tip">押したマスと、上下左右の明かりが切り替わります。<br>同じマスを2回押すと、元に戻ります。</p><p class="lgo-save" data-light="save">この端末に自動保存</p>
  </section>
  <dialog class="lgo-library" aria-labelledby="lgo-library-title"><div class="lgo-library-header"><div><span>THE LIGHT COLLECTION</span><h2 id="lgo-library-title">ライトアウトの問題集</h2></div><button data-light="close-library" aria-label="問題集を閉じる">×</button></div>
    <p class="lgo-library-description">全${PUZZLES.length}問。小さな盤面から、少しずつ。</p>
    <div class="lgo-size-filters" aria-label="盤面サイズで絞り込む"><button data-light-size="0">すべて</button><button data-light-size="3">3 × 3</button><button data-light-size="4">4 × 4</button><button data-light-size="5">5 × 5</button></div>
    <div class="lgo-progress-filters" aria-label="進み具合で絞り込む"><button data-light-progress="all">すべて</button><button data-light-progress="uncompleted">未クリア</button><button data-light-progress="started">途中</button><button data-light-progress="completed">クリア</button></div>
    <div class="lgo-puzzle-grid" data-light="puzzles"></div><p class="lgo-empty" data-light="empty" hidden>この条件に合う問題はまだありません。</p>
    <nav class="lgo-pages" aria-label="問題集のページ"><button data-light="previous-page">← 前へ</button><span data-light="range" aria-live="polite"></span><button data-light="next-page">次へ →</button></nav><p class="lgo-book-progress" data-light="book-progress"></p>
  </dialog>`;
  const find = name => container.querySelector(`[data-light="${name}"]`), board = find('board'), library = container.querySelector('.lgo-library');
  function write(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { if (storageOK) notify('保存できませんでした。この画面を閉じると進捗が失われる場合があります。'); storageOK = false; }
    find('save').textContent = storageOK ? 'この端末に自動保存' : 'この画面内に保存中';
  }
  function progressFor(p) {
    if (book[p.id]) return book[p.id];
    const saved = read(PREFIX + p.id);
    const state = createGame(p, saved ? {...saved, history: []} : null);
    return book[p.id] = {completed: state.completed, started: state.moves > 0 || state.hints > 0};
  }
  function save() {
    write(PREFIX + puzzle.id, serializeGame(game)); write(PREFIX + 'current', puzzle.id);
    book[puzzle.id] = {completed: game.completed, started: game.moves > 0 || game.hints > 0};
    onUpdate({id: 'lights', puzzleId: puzzle.id, completed: game.completed, moves: game.moves});
  }
  function renderBoard() {
    board.style.setProperty('--lgo-n', puzzle.size);
    board.setAttribute('aria-label', `${puzzle.size}行${puzzle.size}列のライトアウト盤面`);
    board.setAttribute('aria-rowcount', puzzle.size); board.setAttribute('aria-colcount', puzzle.size);
    board.innerHTML = game.board.map((lit, index) => `<button type="button" role="gridcell" class="lgo-cell ${lit ? 'lgo-lit' : ''} ${index === suggested ? 'lgo-suggested' : ''}" data-light-cell="${index}" aria-rowindex="${Math.floor(index / puzzle.size) + 1}" aria-colindex="${index % puzzle.size + 1}" aria-label="${Math.floor(index / puzzle.size) + 1}行${index % puzzle.size + 1}列、${lit ? '点灯' : '消灯'}${index === suggested ? '、次の一手' : ''}" tabindex="${focused === index ? 0 : -1}" ${game.completed ? 'disabled' : ''}><span aria-hidden="true"></span>${index === suggested ? '<i aria-hidden="true">◎</i>' : ''}</button>`).join('');
  }
  function render() {
    find('number').textContent = String(PUZZLES.indexOf(puzzle) + 1).padStart(3, '0'); find('size').textContent = `${puzzle.size} × ${puzzle.size}`;
    find('time').textContent = time(game.elapsed); find('moves').textContent = game.moves; find('par').textContent = puzzle.par;
    find('lit').textContent = `点灯 ${game.board.filter(Boolean).length} / ${game.board.length}`;
    find('undo').disabled = !game.history.length; find('hint').disabled = game.completed;
    find('status').textContent = game.completed ? 'すべての明かりを消せました。' : suggested >= 0 ? `${Math.floor(suggested / puzzle.size) + 1}行${suggested % puzzle.size + 1}列を押してみましょう。` : '明かりをタップして、すべて消そう。';
    find('completion').hidden = !game.completed;
    if (game.completed) find('clear-stats').textContent = `${game.moves}手 · ${time(game.elapsed)} · ヒント ${game.hints}回`;
    renderBoard();
  }
  function applied(result) {
    if (!result.changed) return;
    const completed = game.completed; game = result.state; suggested = -1; save(); render();
    if (!completed && game.completed) notify('すべての明かりが消えました！');
  }
  function loadPuzzle(id) {
    tick(); save(); puzzle = PUZZLES.find(p => p.id === id) || PUZZLES[0]; game = createGame(puzzle, read(PREFIX + puzzle.id));
    focused = 0; suggested = -1; fraction = 0; last = performance.now(); lastSaved = -1; library.close(); save(); render();
  }
  function matchingPuzzles() {
    return PUZZLES.filter(p => { const state = progressFor(p); return (!filter || p.size === filter) && (progressFilter === 'all' || progressFilter === 'uncompleted' && !state.completed || progressFilter === 'started' && state.started && !state.completed || progressFilter === 'completed' && state.completed); });
  }
  function renderLibrary() {
    const matching = matchingPuzzles(), pages = Math.max(1, Math.ceil(matching.length / pageSize)); page = Math.max(0, Math.min(page, pages - 1));
    container.querySelectorAll('[data-light-size]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.lightSize) === filter)));
    container.querySelectorAll('[data-light-progress]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lightProgress === progressFilter)));
    find('puzzles').innerHTML = matching.slice(page * pageSize, (page + 1) * pageSize).map(p => {
      const state = progressFor(p), number = PUZZLES.indexOf(p) + 1;
      return `<button class="lgo-puzzle ${state.completed ? 'lgo-done' : ''} ${p.id === puzzle.id ? 'lgo-current' : ''}" data-light-puzzle="${p.id}" aria-label="問題${number}、${p.size}かける${p.size}${state.completed ? '、クリア済み' : state.started ? '、途中' : ''}"><strong>${String(number).padStart(3, '0')}${state.completed ? '<i>✓</i>' : ''}</strong><small>${p.size} × ${p.size}</small><span>${state.completed ? 'クリア' : state.started ? '途中から' : `目安${p.par}手`}</span></button>`;
    }).join('');
    find('puzzles').scrollTop = 0; find('empty').hidden = matching.length > 0;
    find('previous-page').disabled = page === 0; find('next-page').disabled = page === pages - 1;
    find('range').textContent = matching.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, matching.length)} / ${matching.length}問` : '0問';
    find('book-progress').textContent = `${PUZZLES.filter(p => progressFor(p).completed).length} / ${PUZZLES.length} 問クリア`;
  }
  function openLibrary() { tick(); save(); book = {}; const index = matchingPuzzles().findIndex(p => p.id === puzzle.id); page = index < 0 ? 0 : Math.floor(index / pageSize); renderLibrary(); library.showModal(); library.scrollTop = 0; }
  function nextPuzzle() {
    const index = PUZZLES.indexOf(puzzle), ordered = [...PUZZLES.slice(index + 1), ...PUZZLES.slice(0, index + 1)];
    const next = ordered.find(p => !progressFor(p).completed);
    if (next) loadPuzzle(next.id); else { openLibrary(); notify('300問すべてクリア。おめでとうございます！'); }
  }
  function click(event) {
    const button = event.target.closest('button'); if (!button || !container.contains(button) || disposed) return;
    if (button.dataset.lightCell !== undefined) { focused = Number(button.dataset.lightCell); applied(press(game, puzzle, focused)); if (!game.completed && event.detail === 0) board.querySelector(`[data-light-cell="${focused}"]`)?.focus({preventScroll: true}); }
    else if (button.dataset.lightPuzzle) loadPuzzle(button.dataset.lightPuzzle);
    else if (button.dataset.lightSize !== undefined) { filter = Number(button.dataset.lightSize); page = 0; renderLibrary(); }
    else if (button.dataset.lightProgress) { progressFilter = button.dataset.lightProgress; page = 0; renderLibrary(); }
    else if (button.dataset.light === 'library') openLibrary();
    else if (button.dataset.light === 'close-library') library.close();
    else if (button.dataset.light === 'previous-page' || button.dataset.light === 'next-page') { page += button.dataset.light === 'next-page' ? 1 : -1; renderLibrary(); }
    else if (button.dataset.light === 'undo') applied(undo(game, puzzle));
    else if (button.dataset.light === 'hint' && !game.completed) {
      suggested = solveLights(game.board, puzzle.size)?.[0] ?? -1;
      if (suggested >= 0) { game = {...game, hints: game.hints + 1}; save(); render(); }
    }
    else if (button.dataset.light === 'next') nextPuzzle();
    else if (button.dataset.light === 'restart') {
      if ((game.moves > 0 || game.hints > 0) && !confirm('この問題の手数とタイムをリセットして、最初から始めますか？')) return;
      game = createGame(puzzle); suggested = -1; fraction = 0; last = performance.now(); lastSaved = -1; save(); render();
    }
  }
  function keydown(event) {
    const button = event.target.closest('[data-light-cell]'); if (!button || game.completed || library.open) return;
    const index = Number(button.dataset.lightCell), n = puzzle.size;
    const target = event.key === 'ArrowRight' ? Math.floor(index / n) * n + (index % n + 1) % n : event.key === 'ArrowLeft' ? Math.floor(index / n) * n + (index % n + n - 1) % n : event.key === 'ArrowUp' ? (index + n * n - n) % (n * n) : event.key === 'ArrowDown' ? (index + n) % (n * n) : null;
    if (target !== null) { event.preventDefault(); focused = target; board.querySelectorAll('[data-light-cell]').forEach(cell => cell.tabIndex = Number(cell.dataset.lightCell) === target ? 0 : -1); board.querySelector(`[data-light-cell="${target}"]`)?.focus({preventScroll: true}); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); applied(undo(game, puzzle)); board.querySelector(`[data-light-cell="${focused}"]`)?.focus({preventScroll: true}); }
  }
  function tick() {
    const now = performance.now();
    if (!game.completed && (game.moves > 0 || game.hints > 0) && !document.hidden && !document.querySelector('dialog[open]')) {
      fraction += now - last;
      if (fraction >= 1000) { const seconds = Math.floor(fraction / 1000); game.elapsed += seconds; fraction -= seconds * 1000; find('time').textContent = time(game.elapsed); }
      if (game.elapsed % 5 === 0 && game.elapsed !== lastSaved) { save(); lastSaved = game.elapsed; }
    }
    last = now;
  }
  function visibility() { last = performance.now(); if (document.hidden) save(); }
  function backdrop(event) { const rect = library.getBoundingClientRect(); if (event.target === library && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) library.close(); }
  container.addEventListener('click', click); board.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', visibility); library.addEventListener('click', backdrop);
  const timer = setInterval(tick, 250); save(); render();
  return () => { if (disposed) return; tick(); save(); disposed = true; clearInterval(timer); container.removeEventListener('click', click); board.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', visibility); library.removeEventListener('click', backdrop); library.close(); library.remove(); };
}
