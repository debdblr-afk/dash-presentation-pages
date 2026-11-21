import {validateDeck} from './store.js';

const filename = 'presentation.orbit.json';
const gistId = /^[0-9a-f]{20,40}$/i;

export function parseGist(value) {
  const input = value.trim();
  if (gistId.test(input)) return input;
  try {
    const url = new URL(input);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.origin === 'https://gist.github.com' && parts.length === 2 && gistId.test(parts[1])) return parts[1];
  } catch {}
  throw new Error('Enter the link to the saved GitHub gist.');
}

export async function loadOnline(id, signal) {
  if (!gistId.test(id)) throw new Error('This presentation link is invalid.');
  const response = await fetch('https://api.github.com/gists/' + id, {signal, credentials:'omit', headers:{Accept:'application/vnd.github+json'}});
  if (!response.ok) throw new Error(response.status === 404 ? 'This online copy is missing or was deleted.' : 'GitHub could not load this copy. Try again later.');
  const gist = await response.json();
  const file = gist.files?.[filename];
  if (!file || file.size > 2000000) throw new Error('The gist needs a presentation.orbit.json file under 2 MB.');
  let json = file.content;
  if (file.truncated) {
    const raw = new URL(file.raw_url);
    if (raw.origin !== 'https://gist.githubusercontent.com') throw new Error('Unexpected file location.');
    const result = await fetch(raw, {signal, credentials:'omit'});
    if (!result.ok) throw new Error('The presentation file could not be read.');
    json = await result.text();
  }
  const payload = JSON.parse(json);
  return validateDeck(payload.deck ?? payload);
}

export function onlineDialog(deck) {
  const dialog = document.createElement('dialog');
  dialog.className = 'editor-dialog online-dialog';
  dialog.innerHTML = `<form method="dialog"><button class="btn btn-ghost" aria-label="Close online save">Close</button></form><h2>Save online</h2>
    <p>Store a snapshot in your GitHub account. Anyone with its link can read the slides and speaker notes.</p>
    <label>1. Copy the presentation<textarea readonly rows="2" aria-label="Presentation JSON"></textarea></label>
    <button type="button" class="btn btn-ghost" data-copy>Copy presentation</button>
    <p>2. On GitHub, name the file <strong>presentation.orbit.json</strong>, paste the copy and choose <strong>Create secret gist</strong>. To update a copy, edit the existing gist.</p>
    <a class="btn btn-ghost" href="https://gist.github.com/" target="_blank" rel="noopener noreferrer">Open GitHub Gist</a>
    <label>3. Paste the saved gist link<input type="url" placeholder="https://gist.github.com/…" /></label>
    <button type="button" class="btn btn-primary" data-verify>Verify online copy</button>
    <p role="status"></p><a data-view hidden target="_blank" rel="noopener">Open online presentation</a>`;
  document.querySelector('#app').append(dialog);
  const area = dialog.querySelector('textarea');
  area.value = JSON.stringify({format:'orbit-studio',version:1,deck},null,2);
  const status = dialog.querySelector('[role=status]');
  const verify = dialog.querySelector('[data-verify]');
  const link = dialog.querySelector('[data-view]');
  const field = dialog.querySelector('input');
  const controller = new AbortController();
  dialog.querySelector('[data-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(area.value); status.textContent = 'Copied. Paste the presentation into the gist file.'; }
    catch { area.focus(); area.select(); status.textContent = 'Press Ctrl+C or ⌘C to copy the selected presentation.'; }
  };
  field.oninput = () => { link.hidden = true; status.textContent = ''; };
  verify.onclick = async () => {
    verify.disabled = true; field.disabled = true; link.hidden = true; status.textContent = 'Checking the online copy…';
    try {
      const id = parseGist(field.value);
      const online = await loadOnline(id, controller.signal);
      if (JSON.stringify(online) !== JSON.stringify(validateDeck(deck))) throw new Error('The saved file differs from this deck. Paste the current copy into the gist and save again.');
      const url = new URL(location.href); url.hash = 'online/' + id;
      link.href = url.href; link.hidden = false;
      status.textContent = 'Online copy verified. Open or bookmark the presentation link.';
    } catch (error) { status.textContent = error.message; }
    finally { verify.disabled = false; field.disabled = false; }
  };
  dialog.onclose = () => { controller.abort(); dialog.remove(); };
  dialog.showModal();
}
