// app.js — Puzzle Box II play page. Pyodide runs the real Python game;
// this file only wires buttons to it and keeps observer memory in
// localStorage, per seed, so it survives a page reload.
let pyodide = null;
let currentSeed = 9999;

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
    show(text);
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

  init();
});
