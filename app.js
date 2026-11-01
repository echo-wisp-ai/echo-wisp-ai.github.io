// app.js — Puzzle Box II play page. Pyodide runs the real Python game;
// this file only wires buttons to it and keeps observer memory in
// localStorage, per seed, so it survives a page reload.
// v2 (data-first): the same play UI, plus a data console — structured
// JSON export, queries, replay-to-tick, diff since last look, and a
// multi-seed survey. The data layer changes no rules.
let pyodide = null;
let currentSeed = 9999;
let lastLookState = null;

const $ = (id) => document.getElementById(id);
const output = $('output');
const statusEl = $('status');

function show(text) {
  output.textContent = text;
}

function observerKey(seed) {
  return 'pb-observer-' + seed;
}

function observerPath(seed) {
  return '/puzzle_box_observer_' + seed + '_12.json';
}

function restoreObserver(seed) {
  const stored = localStorage.getItem(observerKey(seed));
  if (stored) {
    try { pyodide.FS.writeFile(observerPath(seed), stored); } catch (e) { /* fresh observer */ }
  }
}

function syncObserver(seed) {
  try {
    const data = pyodide.FS.readFile(observerPath(seed), { encoding: 'utf8' });
    localStorage.setItem(observerKey(seed), data);
  } catch (e) { /* no observer file yet */ }
}

function run(name, ...args) {
  // Call a pb_web.py helper by name; args are passed as JS values.
  const fn = pyodide.globals.get(name);
  const result = args.length ? fn(...args) : fn();
  if (result && typeof result.destroy === 'function') result.destroy();
  return result;
}

async function init() {
  try {
    pyodide = await loadPyodide();
    const pyText = await (await fetch('puzzle_box_gen2.py')).text();
    const webText = await (await fetch('pb_web.py')).text();
    pyodide.FS.writeFile('/puzzle_box_gen2.py', pyText);
    pyodide.FS.writeFile('/pb_web.py', webText);
    pyodide.runPython("exec(open('/pb_web.py').read())");
    statusEl.textContent = 'Engine ready. Pick a seed and start a world.';
    document.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    await startWorld();
  } catch (e) {
    statusEl.textContent = 'Could not load the engine: ' + e.message + ' — if you are offline, use the command-line version instead.';
    show('Engine failed to load.\n' + e.message);
  }
}

async function startWorld() {
  const seed = parseInt($('seed').value, 10);
  if (Number.isNaN(seed) || seed < 0 || seed > 99999) {
    show('Seed must be a number from 0 to 99999.');
    return;
  }
  currentSeed = seed;
  restoreObserver(seed);
  const text = run('start', seed);
  syncObserver(seed);
  try { lastLookState = JSON.parse(run('state_json')); } catch (e) { lastLookState = null; }
  statusEl.textContent = 'World started, seed ' + seed + '. The observer counts this as a session.';
  show(text);
}

function coords() {
  return [parseInt($('px').value, 10), parseInt($('py').value, 10)];
}

function act(name) {
  try {
    const text = run(name);
    syncObserver(currentSeed);
    if (name === 'look') {
      try { lastLookState = JSON.parse(run('state_json')); } catch (e) { /* keep old */ }
    }
    show(text);
  } catch (e) { show('Error: ' + e.message); }
}

function diffSinceLastLook() {
  try {
    const current = JSON.parse(run('state_json'));
    if (!lastLookState) { show('No previous look to diff against. Click Look first.'); return; }
    const prev = new Map(lastLookState.cells.map((c) => [c.x + ',' + c.y, c]));
    const changes = [];
    for (const c of current.cells) {
      const p = prev.get(c.x + ',' + c.y);
      if (p && p.type !== c.type) changes.push('  ' + c.x.toString(16) + ',' + c.y.toString(16) + '  ' + p.type + ' -> ' + c.type);
    }
    if (!changes.length) {
      show('No changes since t' + lastLookState.tick + ' (last look). The grid is unchanged since then.');
    } else {
      show('Diff since t' + lastLookState.tick + ' to t' + current.tick + ' (' + changes.length + ' cell type change(s)):\n' + changes.join('\n'));
    }
  } catch (e) { show('Error: ' + e.message); }
}

document.addEventListener('DOMContentLoaded', () => {
  // Coordinate pickers: hex label, decimal value (0..11).
  for (const sel of [$('px'), $('py')]) {
    for (let i = 0; i < 12; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i.toString(16) + ' (' + i + ')';
      sel.appendChild(opt);
    }
  }
  $('px').value = '5';
  $('py').value = '5';

  $('startBtn').addEventListener('click', startWorld);
  $('newBtn').addEventListener('click', startWorld);
  document.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', () => act(b.dataset.act));
  });
  $('probeBtn').addEventListener('click', () => {
    const [x, y] = coords();
    try { const t = run('probe', x, y); syncObserver(currentSeed); show(t); }
    catch (e) { show('Error: ' + e.message); }
  });
  $('pokeBtn').addEventListener('click', () => {
    const [x, y] = coords();
    try { const t = run('poke', x, y); syncObserver(currentSeed); show(t); }
    catch (e) { show('Error: ' + e.message); }
  });
  $('waitBtn').addEventListener('click', () => {
    try { const t = run('wait', parseInt($('waitN').value, 10)); syncObserver(currentSeed); show(t); }
    catch (e) { show('Error: ' + e.message); }
  });
  $('markBtn').addEventListener('click', () => {
    try { const t = run('mark', $('markLabel').value || ''); syncObserver(currentSeed); show(t); }
    catch (e) { show('Error: ' + e.message); }
  });

  // v2 data console
  $('queryBtn').addEventListener('click', () => {
    try { const t = run('query', $('queryInput').value || ''); show(t); }
    catch (e) { show('Error: ' + e.message); }
  });
  $('exportBtn').addEventListener('click', () => {
    try {
      const json = run('state_json');
      const data = JSON.parse(json);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'puzzle-box-seed' + data.seed + '-t' + data.tick + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      show(json);
    } catch (e) { show('Error: ' + e.message); }
  });
  $('replayBtn').addEventListener('click', () => {
    try {
      const t = run('replay', parseInt($('replayTick').value, 10));
      syncObserver(currentSeed);
      try { lastLookState = JSON.parse(run('state_json')); } catch (e) { /* keep old */ }
      show(t);
    } catch (e) { show('Error: ' + e.message); }
  });
  $('diffBtn').addEventListener('click', diffSinceLastLook);
  $('surveyBtn').addEventListener('click', () => {
    try {
      statusEl.textContent = 'Survey running… stepping 10 seeds to t250.';
      const t = run('survey');
      statusEl.textContent = 'Survey done.';
      show(t);
    } catch (e) { show('Error: ' + e.message); }
  });

  init();
});
