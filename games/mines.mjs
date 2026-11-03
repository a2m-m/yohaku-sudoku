import { PRESETS, createMines, reveal, toggleFlag, restartMines, restoreMines } from './mines-engine.mjs';

const KEY = 'yohaku-games:v1:mines';
const volatileStore = new Map();
const svg = (path, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${path}</svg>`;
const FLAG = svg('<path d="M6 21V3m0 1c5-4 7 4 13 0v10c-6 4-8-4-13 0"/>');
const MINE = svg('<circle cx="12" cy="12" r="5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3M16 8l3-3"/>');
const timeLabel = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export function mount(container, { notify = () => {}, onUpdate = () => {} } = {}) {
  let state;
  try { state = restoreMines(JSON.parse(volatileStore.has(KEY) ? volatileStore.get(KEY) : localStorage.getItem(KEY))); } catch { /* Private mode or invalid JSON: start fresh. */ }
  state ||= createMines();
  let flagMode = false, paused = false, storageWarned = false, lastTick = performance.now(), fraction = 0, lastSaved = -1, focusIndex = 0;
  let destroyed = false;
  container.classList.add('mns-root');
  container.innerHTML = `<div class="mns-toolbar"><label class="mns-difficulty"><span>難易度</span><select aria-label="マインスイーパーの難易度">${Object.entries(PRESETS).map(([key, p]) => `<option value="${key}">${p.label} · ${p.rows}×${p.cols}</option>`).join('')}</select></label><button class="mns-new" type="button" aria-label="マインスイーパーを新しく始める">新しく始める <span aria-hidden="true">↻</span></button></div><div class="mns-scorebar"><div><span>残りの地雷</span><strong class="mns-remaining">10</strong></div><button type="button" class="mns-pause" aria-label="マインスイーパーを一時停止"><span>タイム</span><strong class="mns-clock">00:00</strong><span class="mns-pause-mark">Ⅱ</span></button><div><span>開いたマス</span><strong class="mns-opened">0 / 71</strong></div></div><div class="mns-board-scroll"><div class="mns-board-wrap"><div class="mns-board" role="grid" aria-label="マインスイーパーの盤面"></div><div class="mns-paused" hidden><span>ひと息つきましょう。</span><button type="button" class="mns-resume">続きをプレイ</button></div></div></div><div class="mns-message" role="status" aria-live="polite"></div><div class="mns-controls"><div class="mns-mode-group" aria-label="タップしたときの動作"><button type="button" class="mns-open-mode" aria-pressed="true"><span aria-hidden="true">□</span> 開く</button><button type="button" class="mns-flag-mode" aria-pressed="false">${FLAG} 旗を立てる</button></div><button type="button" class="mns-retry" hidden>同じ盤面に再挑戦</button></div><p class="mns-tip">数字は、周り8マスにある地雷の数。<br class="mns-mobile-break">初めの1マスと、その周囲は安全です。</p><p class="mns-scroll-tip" hidden>盤面は横にスクロールできます。</p>`;
  const $ = selector => container.querySelector(selector);
  const board = $('.mns-board'), select = $('select');
  select.value = state.difficulty;

  function save() {
    const serialized = JSON.stringify(state);
    volatileStore.set(KEY, serialized);
    try { localStorage.setItem(KEY, serialized); }
    catch { if (!storageWarned) { notify('このブラウザでは保存できません。画面を閉じると進捗が失われる場合があります。'); storageWarned = true; } }
    onUpdate({ game: 'mines', started: state.firstIndex !== null, completed: state.status === 'won' });
  }
  function updateStats() {
    $('.mns-clock').textContent = timeLabel(state.elapsed);
    $('.mns-remaining').textContent = String(state.status === 'won' ? 0 : state.mineCount - state.flags.filter(Boolean).length).padStart(2, '0');
    $('.mns-opened').textContent = `${state.open.filter((v, i) => v && !state.mines[i]).length} / ${state.rows * state.cols - state.mineCount}`;
  }
  function render() {
    const ended = state.status === 'won' || state.status === 'lost';
    updateStats();
    board.style.setProperty('--mns-cols', state.cols);
    board.classList.toggle('mns-board-large', state.cols > 9);
    board.setAttribute('aria-label', `${state.rows}行${state.cols}列のマインスイーパー盤面`);
    $('.mns-board-wrap').style.setProperty('--mns-cols', state.cols);
    board.innerHTML = state.open.map((open, i) => {
      const mineVisible = ended && state.mines[i];
      const incorrectFlag = state.status === 'lost' && state.flags[i] && !state.mines[i];
      const flagVisible = state.flags[i] || (state.status === 'won' && state.mines[i]);
      const count = state.adjacent[i];
      const text = mineVisible && state.status !== 'won' ? MINE : flagVisible ? FLAG : open && count ? count : '';
      const label = `${Math.floor(i / state.cols) + 1}行${i % state.cols + 1}列、${incorrectFlag ? '間違った旗' : mineVisible ? state.status === 'won' ? '地雷、クリア' : '地雷' : flagVisible ? '旗' : open ? count ? `周囲の地雷${count}個` : '周囲に地雷なし' : '未開封'}`;
      return `<button type="button" class="mns-cell ${open ? 'mns-revealed' : ''} ${flagVisible ? 'mns-flagged' : ''} ${mineVisible ? 'mns-mine' : ''} ${i === state.detonated ? 'mns-hit' : ''} ${incorrectFlag ? 'mns-wrong-flag' : ''}" data-index="${i}" data-number="${open ? count : 0}" role="gridcell" aria-label="${label}" tabindex="${i === focusIndex ? 0 : -1}" ${ended || paused ? 'disabled' : ''}>${text}</button>`;
    }).join('');
    $('.mns-open-mode').setAttribute('aria-pressed', String(!flagMode));
    $('.mns-flag-mode').setAttribute('aria-pressed', String(flagMode));
    $('.mns-paused').hidden = !paused;
    board.classList.toggle('mns-hidden', paused);
    $('.mns-pause').disabled = ended || state.status === 'ready';
    $('.mns-pause').setAttribute('aria-label', paused ? 'マインスイーパーを再開' : 'マインスイーパーを一時停止');
    $('.mns-pause-mark').textContent = paused ? '▷' : 'Ⅱ';
    $('.mns-retry').hidden = !ended;
    $('.mns-message').classList.toggle('mns-success', state.status === 'won');
    $('.mns-message').textContent = state.status === 'won' ? `すべての安全なマスを開きました！ ${timeLabel(state.elapsed)}でクリア。` : state.status === 'lost' ? '地雷がありました。同じ盤面で、もう一度挑戦できます。' : paused ? '一時停止中です。' : state.status === 'ready' ? '好きなマスをタップして、スタート。' : flagMode ? '地雷だと思うマスに旗を。もう一度タップで外せます。' : '旗の数が合った数字をタップすると、周囲をまとめて開けます。';
    $('.mns-scroll-tip').hidden = state.cols <= 9;
    $('.mns-open-mode').disabled = ended || paused;
    $('.mns-flag-mode').disabled = ended || paused;
  }
  function tick() {
    const now = performance.now();
    if (!document.hidden && !paused && !document.querySelector('dialog[open]') && state.status === 'playing') {
      fraction += now - lastTick;
      if (fraction >= 1000) { const seconds = Math.floor(fraction / 1000); state.elapsed += seconds; fraction -= seconds * 1000; updateStats(); }
      if (state.elapsed % 5 === 0 && state.elapsed !== lastSaved) { save(); lastSaved = state.elapsed; }
    }
    lastTick = now;
  }
  function apply(next) {
    if (next === state) return;
    state = next; save(); render();
  }
  function reset(difficulty = state.difficulty) { state = createMines(difficulty); flagMode = false; paused = false; fraction = 0; lastTick = performance.now(); lastSaved = -1; focusIndex = 0; select.value = difficulty; save(); render(); }
  function cellAction(index, flag = flagMode) {
    if (paused) return;
    tick(); focusIndex = index;
    const next = flag ? toggleFlag(state, index) : reveal(state, index);
    if (flag && next === state && !state.open[index] && !state.flags[index] && state.flags.filter(Boolean).length >= state.mineCount) notify('旗は地雷の数まで立てられます。不要な旗を外してください。');
    apply(next);
    board.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true });
  }
  function handleClick(event) { const cell = event.target.closest('[data-index]'); if (cell) cellAction(Number(cell.dataset.index)); }
  function handleContext(event) { const cell = event.target.closest('[data-index]'); if (cell) { event.preventDefault(); cellAction(Number(cell.dataset.index), true); } }
  function handleKey(event) {
    const cell = event.target.closest('[data-index]'); if (!cell || paused) return;
    const i = Number(cell.dataset.index), row = Math.floor(i / state.cols), col = i % state.cols;
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); cellAction(i, true); return; }
    const next = event.key === 'ArrowRight' ? row * state.cols + (col + 1) % state.cols : event.key === 'ArrowLeft' ? row * state.cols + (col + state.cols - 1) % state.cols : event.key === 'ArrowUp' ? (i + state.rows * state.cols - state.cols) % (state.rows * state.cols) : event.key === 'ArrowDown' ? (i + state.cols) % (state.rows * state.cols) : null;
    if (next !== null) { event.preventDefault(); focusIndex = next; board.querySelectorAll('[data-index]').forEach(el => { el.tabIndex = Number(el.dataset.index) === next ? 0 : -1; }); board.querySelector(`[data-index="${next}"]`)?.focus(); }
  }
  function pause() { tick(); paused = !paused; lastTick = performance.now(); save(); render(); }
  function visibility() { lastTick = performance.now(); if (document.hidden) save(); }
  board.addEventListener('click', handleClick); board.addEventListener('contextmenu', handleContext); board.addEventListener('keydown', handleKey);
  $('.mns-open-mode').addEventListener('click', () => { flagMode = false; render(); });
  $('.mns-flag-mode').addEventListener('click', () => { flagMode = true; render(); });
  $('.mns-new').addEventListener('click', () => { if (state.status !== 'playing' || confirm('今の盤面を終了して、新しい問題を始めますか？')) reset(); });
  select.addEventListener('change', () => { const choice = select.value; if (state.status !== 'playing' || confirm('今の盤面を終了して、難易度を変えますか？')) reset(choice); else select.value = state.difficulty; });
  $('.mns-retry').addEventListener('click', () => { state = restartMines(state); paused = false; flagMode = false; focusIndex = state.firstIndex ?? 0; fraction = 0; lastTick = performance.now(); save(); render(); });
  $('.mns-pause').addEventListener('click', pause); $('.mns-resume').addEventListener('click', pause);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', save);
  const timer = setInterval(tick, 250);
  render();
  return () => { if (destroyed) return; tick(); save(); destroyed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', save); container.classList.remove('mns-root'); container.innerHTML = ''; };
}
