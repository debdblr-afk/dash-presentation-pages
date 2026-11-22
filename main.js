import {loadDecks, saveDecks, createDeck, createId, validateDeck, STORAGE_KEY} from './store.js';
import {renderDashboard} from './dashboard.js';
import {renderEditor} from './editor.js';
import {loadOnline} from './online.js';

const root = document.getElementById('app');
const alertBox = document.getElementById('save-alert');
let decks = [], savedDecks = [], cleanup = () => {}, toastTimer;
let savedSnapshot = null, blockedReason = '', saveMessage = '', unsaved = false;
const copy = value => structuredClone(value);
const serialized = value => JSON.stringify(value);

function readSnapshot() { return localStorage.getItem(STORAGE_KEY); }
function activeId() {
  const match = location.hash.match(/^#editor\/(.+)$/);
  try { return match ? decodeURIComponent(match[1]) : null; } catch { return null; }
}
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = `${message}${unsaved ? ' · Changes are only in this tab.' : ''}`;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 4500);
}
function refreshSaveLabels() {
  if (!unsaved && !blockedReason) return;
  const label = root.querySelector('.save-state');
  if (label) label.textContent = 'Not saved · export a backup';
  const storageNote = root.querySelector('.storage-note span:last-child');
  if (storageNote) {
    storageNote.textContent = 'Changes stay in this tab';
    const hint = document.createElement('small');
    hint.textContent = 'Resolve the save notice or export a copy.';
    storageNote.append(hint);
  }
}
function downloadCurrent() {
  const deck = decks.find(d => d.id === activeId()) || decks[0];
  if (!deck) { toast('Open a presentation to export a copy.'); return; }
  const blob = new Blob([JSON.stringify({format:'orbit-studio',version:1,deck},null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url;
  link.download = `${deck.title.replace(/[^a-z0-9\-_ ]/gi,'').slice(0,70) || 'presentation'}.orbit.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Current presentation exported');
}
function showSaveNotice() {
  alertBox.replaceChildren();
  alertBox.hidden = !saveMessage;
  if (!saveMessage) return;
  const message = document.createElement('span');
  message.textContent = saveMessage;
  alertBox.append(message);
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
  function button(label, callback) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'btn btn-ghost'; el.textContent = label;
    el.style.cssText = 'font-size:11px;padding:5px 10px;min-height:30px;background:white';
    el.addEventListener('click', callback); controls.append(el);
  }
  if (decks.length) button('Download current copy', downloadCurrent);
  if (blockedReason === 'external') button('Keep edited copies', keepEditedCopies);
  button(blockedReason ? 'Load saved workspace' : 'Retry saving', blockedReason ? reloadSavedWorkspace : retrySave);
  alertBox.append(controls);
  queueMicrotask(refreshSaveLabels);
}
function saveError(error, reason = '') {
  if (reason) blockedReason = reason;
  saveMessage = blockedReason === 'external'
    ? 'Another tab changed this workspace. Saving is paused so neither version is overwritten. Keep edited copies, or download your work before loading the saved workspace.'
    : `Saving is paused. ${error.message} Your changes remain in this tab; export a copy before leaving.`;
  showSaveNotice();
}
function markSaved(next) {
  decks = next;
  savedDecks = copy(next);
  savedSnapshot = readSnapshot();
  unsaved = false; blockedReason = ''; saveMessage = '';
  showSaveNotice();
}
try { markSaved(loadDecks()); }
catch (error) {
  // Never overwrite a damaged or unreadable repository with the fallback deck.
  decks = [createDeck('strategy', 'Welcome to Dash Presentation')];
  unsaved = true;
  saveError(error, 'unreadable');
}

function persist(next) {
  decks = copy(next);
  unsaved = true;
  if (blockedReason) { showSaveNotice(); return false; }
  try {
    // Check even if the other tab's storage event has not been delivered yet.
    if (readSnapshot() !== savedSnapshot) {
      saveError(new Error('The saved workspace changed.'), 'external');
      return false;
    }
    markSaved(saveDecks(decks));
    return true;
  } catch (error) { saveError(error); return false; }
}
function retrySave() {
  if (persist(decks)) { toast('Workspace saved in this browser'); render(); }
}
function latestWorkspace() {
  // Removing the storage key in another tab is an empty workspace, not a request to reseed.
  const raw = readSnapshot();
  return {raw, decks:raw === null ? [] : loadDecks()};
}
function reloadSavedWorkspace() {
  if (unsaved && !window.confirm('Load the saved workspace and discard changes kept only in this tab? Download a copy first if you want to keep them.')) return;
  try {
    const latest = latestWorkspace();
    decks = latest.decks; savedDecks = copy(decks); savedSnapshot = latest.raw;
    unsaved = false; blockedReason = ''; saveMessage = ''; showSaveNotice();
    if (!decks.some(d => d.id === activeId())) navigate('#dashboard'); else render();
    toast('Saved workspace loaded');
  } catch (error) { saveError(error, 'unreadable'); }
}
function keepEditedCopies() {
  try {
    const latest = latestWorkspace();
    const previous = new Map(savedDecks.map(d => [d.id, serialized(d)]));
    const changed = decks.filter(d => previous.get(d.id) !== serialized(d));
    const now = new Date().toISOString();
    const recovered = changed.map(d => ({...copy(d), id:createId(),
      title:`${d.title.slice(0,157)} (recovered copy)`, createdAt:now, updatedAt:now}));
    // Recovery adds distinct copies; it never restores deleted IDs or reapplies stale deletions.
    if (readSnapshot() !== latest.raw) throw new Error('The other tab changed again. Try keeping your edited copies once more.');
    if (recovered.length) markSaved(saveDecks([...recovered, ...latest.decks]));
    else {
      decks = latest.decks; savedDecks = copy(decks); savedSnapshot = latest.raw;
      unsaved = false; blockedReason = ''; saveMessage = ''; showSaveNotice();
    }
    if (recovered.length) openDeck(recovered[0].id); else navigate('#dashboard');
    toast(recovered.length ? `${recovered.length} edited ${recovered.length === 1 ? 'copy saved' : 'copies saved'}. Other-tab changes were kept.` : 'Saved workspace loaded');
  } catch (error) { saveError(error, 'external'); }
}
function navigate(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function openDeck(id) { navigate(`#editor/${encodeURIComponent(id)}`); }
function render() {
  cleanup(); root.innerHTML = '';
  if (location.hash.startsWith('#online/')) {
    const controller = new AbortController();
    cleanup = () => controller.abort();
    const panel = document.createElement('section');
    panel.className = 'online-loading';
    const message = document.createElement('p');
    message.setAttribute('role','status');
    message.textContent = 'Loading online presentation…';
    const back = document.createElement('a');
    back.href = '#dashboard'; back.textContent = 'Back to presentations';
    panel.append(message,back); root.append(panel);
    loadOnline(location.hash.slice(8), controller.signal).then(online => {
      if (controller.signal.aborted) return;
      document.title = online.title + ' — Dash Presentation';
      cleanup = renderEditor({root,deck:online,onBack:()=>navigate('#dashboard'),onToast:toast,onUpdate:()=>false,onlineView:true});
    }).catch(error => { if (!controller.signal.aborted) message.textContent = error.message; });
    return;
  }
  const deck = decks.find(d => d.id === activeId());
  if (deck) {
    document.title = `${deck.title} — Dash Presentation`;
    cleanup = renderEditor({root, deck:copy(deck), onBack:() => navigate('#dashboard'),
      onUpdate:updated => persist(decks.map(d => d.id === updated.id ? copy(updated) : d)), onToast:toast});
  } else {
    document.title = 'Dash Presentation — Ideas in motion';
    cleanup = renderDashboard({root, decks:copy(decks), onOpen:openDeck,
      onCreate:template => { const deck = createDeck(template); persist([deck,...decks]); openDeck(deck.id); },
      onChange:next => { const saved = persist(next); queueMicrotask(refreshSaveLabels); return saved; },
      onImport:() => document.getElementById('import-file').click(), onToast:toast});
  }
  refreshSaveLabels();
}
window.addEventListener('hashchange', render);
document.getElementById('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('Please choose a JSON file smaller than 2 MB.');
    const raw = JSON.parse(await file.text());
    const imported = validateDeck(raw.deck ?? raw);
    imported.id = createId();
    imported.createdAt = new Date().toISOString(); imported.updatedAt = imported.createdAt;
    const saved = persist([imported,...decks]);
    toast(saved ? 'Presentation imported and saved' : 'Presentation imported into this tab');
    openDeck(imported.id);
  } catch (error) { toast(`Import failed: ${error.message}`); }
});
window.addEventListener('storage', event => {
  if (event.storageArea !== localStorage || (event.key !== STORAGE_KEY && event.key !== null)) return;
  try {
    if (readSnapshot() === savedSnapshot) return;
    if (activeId() || unsaved || blockedReason) {
      saveError(new Error('Another tab changed the workspace.'), 'external');
    } else {
      const latest = latestWorkspace();
      decks = latest.decks; savedDecks = copy(decks); savedSnapshot = latest.raw;
      render(); toast('Workspace updated from another tab');
    }
  } catch (error) { saveError(error, 'unreadable'); }
});
window.addEventListener('beforeunload', event => {
  if (unsaved) { event.preventDefault(); event.returnValue = ''; }
});
render();
