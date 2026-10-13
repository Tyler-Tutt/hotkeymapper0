'use strict';

const STORAGE_KEY = 'hotkeymapper.v1';

// ---------- State ----------
// state = { activeProfile: id, profiles: { [id]: Profile } }
// Profile = { name, rows, cols, buttons: { [index]: { code, action, notes } } }
let state = load();
let selected = null;   // selected button index
let rebinding = false; // waiting for a physical key to bind
let pendingModifier = null; // modifier code pressed while rebinding; binds alone if released without a main key

function newProfile(name) {
  return { name, rows: 3, cols: 6, buttons: {} };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.profiles && saved.profiles[saved.activeProfile]) return saved;
  } catch (e) { /* fall through to default */ }
  const id = uid();
  return { activeProfile: id, profiles: { [id]: newProfile('Default') } };
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function profile() { return state.profiles[state.activeProfile]; }
function button(i) { return profile().buttons[i] || (profile().buttons[i] = { code: '', mods: [], action: '', notes: '' }); }

// ---------- Chords ----------
// A binding is a key `code` plus optional `mods` (subset of MOD_ORDER).
const MOD_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'];
const MOD_OF_CODE = {
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', MetaLeft: 'Meta', MetaRight: 'Meta',
};

// Modifiers held in a keyboard event, excluding the pressed key itself when it is a modifier.
function eventMods(e) {
  const held = { Ctrl: e.ctrlKey, Alt: e.altKey, Shift: e.shiftKey, Meta: e.metaKey };
  delete held[MOD_OF_CODE[e.code]];
  return MOD_ORDER.filter((m) => held[m]);
}

function bindingLabel(b) {
  if (!b || !b.code) return 'unbound';
  return [...(b.mods || []), keyLabel(b.code)].join('+');
}

function matches(b, e) {
  if (!b.code || b.code !== e.code) return false;
  const want = b.mods || [];
  const have = eventMods(e);
  return want.length === have.length && want.every((m, i) => m === have[i]);
}

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const el = {
  select: $('profile-select'), grid: $('grid'), rows: $('rows'), cols: $('cols'),
  detail: $('detail'), none: $('no-selection'), boundKey: $('bound-key'),
  action: $('action'), notes: $('notes'), lastKey: $('last-key'), rebind: $('rebind'), quickEdit: $('quick-edit'),
};

// ---------- Rendering ----------
function keyLabel(code) {
  if (!code) return 'unbound';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}

function renderProfiles() {
  el.select.innerHTML = '';
  for (const [id, p] of Object.entries(state.profiles)) {
    el.select.add(new Option(p.name, id, false, id === state.activeProfile));
  }
}

function renderGrid() {
  const p = profile();
  el.rows.value = p.rows;
  el.cols.value = p.cols;
  el.grid.style.gridTemplateColumns = `repeat(${p.cols}, minmax(0, 1fr))`;
  el.grid.innerHTML = '';
  for (let i = 0; i < p.rows * p.cols; i++) {
    const b = p.buttons[i] || {};
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell' + (b.code ? '' : ' unbound') + (i === selected ? ' selected' : '');
    cell.dataset.index = i;
    cell.innerHTML = `<span class="key"></span><span class="action"></span>`;
    cell.querySelector('.key').textContent = bindingLabel(b);
    cell.querySelector('.action').textContent = b.action || '';
    el.grid.appendChild(cell);
  }
}

function renderDetail() {
  const has = selected !== null;
  el.detail.hidden = !has;
  el.none.hidden = has;
  if (!has) return;
  const b = profile().buttons[selected] || {};
  el.boundKey.textContent = b.code ? bindingLabel(b) : '—';
  el.action.value = b.action || '';
  el.notes.value = b.notes || '';
  setRebinding(false);
}

function renderAll() { renderProfiles(); renderGrid(); renderDetail(); }

function setRebinding(on) {
  rebinding = on;
  pendingModifier = null;
  el.rebind.classList.toggle('rebinding', on);
  el.rebind.textContent = on ? 'Listening…' : 'Press a key…';
}

// ---------- Grid interaction ----------
el.grid.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  selected = Number(cell.dataset.index);
  renderGrid();
  renderDetail();
  if (el.quickEdit.checked) setRebinding(true); // after renderDetail, which disarms
});

el.quickEdit.addEventListener('change', () => {
  $('hint').textContent = el.quickEdit.checked
    ? 'Quick edit: click a button, then press a key to bind it (Esc cancels).'
    : 'Click a button to select it, then press a physical key to bind it.';
  if (!el.quickEdit.checked) setRebinding(false);
});

// Typing in a field must never be captured as a binding.
document.addEventListener('focusin', (e) => {
  if (e.target.matches('input[type="text"], textarea')) setRebinding(false);
});

function resize() {
  const p = profile();
  p.rows = Math.min(12, Math.max(1, Number(el.rows.value) || p.rows));
  p.cols = Math.min(16, Math.max(1, Number(el.cols.value) || p.cols));
  if (selected !== null && selected >= p.rows * p.cols) selected = null;
  save(); renderGrid(); renderDetail();
}
el.rows.addEventListener('change', resize);
el.cols.addEventListener('change', resize);

// ---------- Detail form ----------
el.action.addEventListener('input', () => { button(selected).action = el.action.value; save(); renderGrid(); });
el.notes.addEventListener('input', () => { button(selected).notes = el.notes.value; save(); });
el.rebind.addEventListener('click', () => setRebinding(true));
$('clear-key').addEventListener('click', () => { Object.assign(button(selected), { code: '', mods: [] }); save(); renderGrid(); renderDetail(); });

// ---------- Key capture ----------
let flashTimers = new Map();
function flash(index) {
  const cell = el.grid.children[index];
  if (!cell) return;
  cell.classList.add('flash');
  clearTimeout(flashTimers.get(index));
  flashTimers.set(index, setTimeout(() => cell.classList.remove('flash'), 200));
}

document.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input, textarea, select');

  if (rebinding) {
    e.preventDefault();
    if (e.code === 'Escape') { setRebinding(false); return; }
    if (MOD_OF_CODE[e.code]) {
      // Wait: either a main key follows (chord) or this modifier is released (modifier-only binding).
      if (!pendingModifier) pendingModifier = e.code;
      return;
    }
    Object.assign(button(selected), { code: e.code, mods: eventMods(e) });
    save(); renderGrid(); renderDetail();
    return;
  }

  if (typing) return; // don't hijack keys while editing text fields

  el.lastKey.textContent = [...eventMods(e), `${keyLabel(e.code)} (${e.code})`].join('+');
  const buttons = profile().buttons;
  for (const [i, b] of Object.entries(buttons)) {
    if (matches(b, e)) { e.preventDefault(); flash(Number(i)); }
  }
});

document.addEventListener('keyup', (e) => {
  if (rebinding && pendingModifier === e.code) {
    Object.assign(button(selected), { code: e.code, mods: [] });
    save(); renderGrid(); renderDetail();
  }
});

// ---------- Profiles ----------
el.select.addEventListener('change', () => {
  state.activeProfile = el.select.value; selected = null; save(); renderAll();
});

$('profile-new').addEventListener('click', () => {
  const name = prompt('New profile name (e.g. the game or app):');
  if (!name) return;
  const id = uid();
  state.profiles[id] = newProfile(name.trim());
  state.activeProfile = id; selected = null; save(); renderAll();
});

$('profile-rename').addEventListener('click', () => {
  const name = prompt('Rename profile:', profile().name);
  if (!name) return;
  profile().name = name.trim(); save(); renderProfiles();
});

$('profile-delete').addEventListener('click', () => {
  const ids = Object.keys(state.profiles);
  if (ids.length === 1) { alert('You need at least one profile.'); return; }
  if (!confirm(`Delete profile "${profile().name}"?`)) return;
  delete state.profiles[state.activeProfile];
  state.activeProfile = Object.keys(state.profiles)[0];
  selected = null; save(); renderAll();
});

// ---------- Export / import ----------
$('export').addEventListener('click', () => {
  const p = profile();
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${p.name.replace(/[^\w-]+/g, '_')}.hotkeys.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const p = JSON.parse(await file.text());
    if (!p || typeof p.name !== 'string' || !Number.isInteger(p.rows) || !Number.isInteger(p.cols) || typeof p.buttons !== 'object') {
      throw new Error('Not a Hotkey Mapper profile.');
    }
    const id = uid();
    state.profiles[id] = p;
    state.activeProfile = id; selected = null; save(); renderAll();
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
});

renderAll();
