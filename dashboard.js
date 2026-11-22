import { createId, TEMPLATES } from './store.js?v=20261122-3';

const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9Z"/>',
  template: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 4v16M10 11h10"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  list: '<path d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  folder: '<path d="M3 7V5h6l2 2h10v13H3Z"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
};
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo = '<svg class="orbit-logo" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="7" stroke="currentColor" stroke-width="2.2"/><ellipse cx="20" cy="20" rx="18" ry="11" transform="rotate(-40 20 20)" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="10" r="3.5" fill="currentColor"/></svg>';
const themeId = value => ['forest','peach','ocean','lilac','circles'].includes(value) ? value : 'forest';
function timeAgo(value) {
  const age = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(age)) return 'Saved locally';
  if (age < 60000) return 'Edited just now';
  if (age < 3600000) return `Edited ${Math.floor(age/60000)}m ago`;
  if (age < 86400000) return `Edited ${Math.floor(age/3600000)}h ago`;
  if (age < 604800000) return `Edited ${Math.floor(age/86400000)}d ago`;
  return `Edited ${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(value))}`;
}
export function thumbnail(deck, className = '') {
  const nodes = (deck.nodes || []).filter(n => !n.parentId).slice(0,3);
  const labels = nodes.length ? nodes.map(n=>n.title) : ['The idea', 'The story', 'What’s next'];
  return `<div class="deck-preview theme-${themeId(deck.theme)} ${esc(className)}" aria-hidden="true">
    <div class="preview-grid"></div><span class="preview-kicker">${deck.nodes?.length ? `${deck.nodes.length} MOMENTS · ONE STORY` : 'A NEW PERSPECTIVE'}</span>
    <strong class="preview-title">${esc(deck.title || deck.name || 'Start with an idea')}</strong>
    <svg class="preview-lines" viewBox="0 0 360 190" preserveAspectRatio="none"><path d="M50 155 C100 100 120 185 180 132 S240 105 305 155" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="283" cy="48" r="28" fill="none" stroke="currentColor" stroke-width=".6"/><circle cx="283" cy="48" r="18" fill="none" stroke="currentColor" stroke-width=".6"/></svg>
    <div class="preview-nodes">${labels.map((label,i)=>`<div class="preview-node node-${i}"><span>0${i+1}</span><b>${esc(label)}</b></div>`).join('')}</div>
    <span class="preview-mark">${logo}</span>
  </div>`;
}
function cloneDeck(deck) {
  const copy = JSON.parse(JSON.stringify(deck));
  const ids = new Map(copy.nodes.map(n => [n.id, createId()]));
  copy.id = createId(); copy.title = `${copy.title.slice(0,153)} (copy)`; copy.starred = false;
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  copy.nodes = copy.nodes.map(n => ({...n,id:ids.get(n.id),parentId:n.parentId ? ids.get(n.parentId) || null : null}));
  copy.path = copy.path.map(id => ids.get(id)).filter(Boolean);
  return copy;
}

export function renderDashboard({root,decks,onOpen,onCreate,onChange,onImport,onToast}) {
  let items = decks;
  let view = 'all', query = '', sort = 'updated', layout = 'grid', category = 'All';
  let activeMenu = null, dialogEl = null, destroyed = false;
  const signalController = new AbortController();
  const signal = signalController.signal;
  const showToast = (message) => onToast?.(message);
  function commit(next) { items = next; onChange(next); if (!destroyed) paint(); }
  function filteredDecks() {
    return items.filter(d => (view !== 'starred' || d.starred) && d.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a,b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'created' ? new Date(b.createdAt)-new Date(a.createdAt) : new Date(b.updatedAt)-new Date(a.updatedAt));
  }
  function navButton(id,label,ico,count) {
    return `<button class="side-nav-item ${view===id?'is-active':''}" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(ico)}<span>${label}</span>${count!==undefined?`<span class="nav-count">${count}</span>`:''}</button>`;
  }
  function card(d) {
    return `<article class="presentation-card" data-deck="${esc(d.id)}">
      <button class="deck-open" data-open="${esc(d.id)}" aria-label="Edit ${esc(d.title)}">${thumbnail(d)}<span class="preview-hover">Open presentation ${icon('arrow')}</span></button>
      <div class="presentation-meta"><button class="deck-title" data-open="${esc(d.id)}" title="${esc(d.title)}">${esc(d.title)}</button><div class="meta-actions"><button class="icon-btn star-button ${d.starred?'is-starred':''}" data-star="${esc(d.id)}" aria-label="${d.starred?'Unstar':'Star'} ${esc(d.title)}" aria-pressed="${!!d.starred}">${icon('star')}</button><div class="card-menu-wrap"><button class="icon-btn menu-trigger" data-menu="${esc(d.id)}" aria-label="Actions for ${esc(d.title)}" aria-expanded="${activeMenu===d.id}" aria-haspopup="menu">${icon('more')}</button>${activeMenu===d.id?`<div class="card-menu" role="menu"><button role="menuitem" data-rename="${esc(d.id)}">${icon('edit')}Rename</button><button role="menuitem" data-duplicate="${esc(d.id)}">${icon('copy')}Duplicate</button><button class="danger-text" role="menuitem" data-delete="${esc(d.id)}">${icon('trash')}Delete</button></div>`:''}</div></div><p class="deck-details">${timeAgo(d.updatedAt)}<span>·</span>${d.nodes.length} ${d.nodes.length===1?'topic':'topics'}</p></div>
    </article>`;
  }
  function templatesContent(compact=false) {
    const categories = ['All', ...new Set(TEMPLATES.map(t=>t.category).filter(Boolean))];
    const shown = TEMPLATES.filter(t => category === 'All' || t.category === category);
    return `<section class="template-section ${compact?'compact-templates':''}"><div class="section-heading"><div><h2>${compact?'A head start for every story':'Find your starting point'}</h2><p class="muted">A little structure. Plenty of room to make it yours.</p></div>${compact?`<button class="text-button" data-view="templates">Explore templates ${icon('arrow')}</button>`:''}</div>${!compact?`<div class="template-filters" aria-label="Template categories">${categories.map(c=>`<button class="filter-pill ${category===c?'selected':''}" data-category="${esc(c)}" aria-pressed="${category===c}">${esc(c)}</button>`).join('')}</div>`:''}<div class="template-grid">${(compact?shown.slice(0,3):shown).map(t=>`<article class="template-card"><button class="template-preview-button" data-template="${esc(t.id)}" aria-label="Use ${esc(t.name)} template">${thumbnail({title:t.name,theme:t.theme,nodes:[]})}<span class="template-use">Use template ${icon('arrow')}</span></button><div class="template-info"><span class="eyebrow">${esc(t.category)}</span><h3>${esc(t.name)}</h3>${!compact?`<p>${esc(t.description)}</p><button class="btn btn-template" data-template="${esc(t.id)}">Use template ${icon('arrow')}</button>`:''}</div></article>`).join('')}</div></section>`;
  }
  function libraryContent() {
    const visible = filteredDecks();
    return `<section class="library-section" aria-label="Presentations"><div class="section-heading library-heading"><div class="library-title"><h2>${view==='starred'?'Starred presentations':'Your presentations'}</h2><span class="count-badge">${visible.length}</span></div><div class="library-controls"><label class="search-field">${icon('search')}<input id="presentation-search" type="search" placeholder="Search presentations" aria-label="Search presentations" value="${esc(query)}"></label><label class="sort-field"><span class="sr-only">Sort presentations</span><select id="presentation-sort" aria-label="Sort presentations"><option value="updated" ${sort==='updated'?'selected':''}>Last edited</option><option value="created" ${sort==='created'?'selected':''}>Date created</option><option value="title" ${sort==='title'?'selected':''}>Name A–Z</option></select></label><div class="layout-switch" aria-label="Presentation layout"><button class="icon-btn ${layout==='grid'?'selected':''}" data-layout="grid" aria-label="Grid view" aria-pressed="${layout==='grid'}">${icon('grid')}</button><button class="icon-btn ${layout==='list'?'selected':''}" data-layout="list" aria-label="List view" aria-pressed="${layout==='list'}">${icon('list')}</button></div></div></div><div id="deck-results">${visible.length?`<div class="presentation-grid ${layout==='list'?'is-list':''}">${visible.map(card).join('')}</div>`:`<div class="empty-library"><span class="empty-icon">${icon(query?'search':view==='starred'?'star':'folder')}</span><h3>${query?'No matching presentations':view==='starred'?'Keep your favorites close':'Your next idea starts here'}</h3><p>${query?'Try a different title or clear your search.':view==='starred'?'Star a presentation to find it quickly in this space.':'Create your first presentation on a canvas that grows with you.'}</p>${query?'<button class="btn" data-clear-search>Clear search</button>':view==='starred'?'<button class="btn" data-view="all">View all presentations</button>':'<button class="btn btn-primary" data-new>Create a presentation</button>'}</div>`}</div></section>`;
  }
  function paint() {
    if (destroyed) return;
    const searchFocused = document.activeElement?.id === 'presentation-search';
    const selectionStart = searchFocused ? document.activeElement.selectionStart : null;
    root.innerHTML = `<div class="dashboard-shell"><aside class="workspace-sidebar"><a class="brand" href="#dashboard" aria-label="Dash Presentation home">${logo}<span>Dash<span class="brand-studio"> Presentation</span></span></a><div class="workspace-label"><span class="workspace-avatar">O</span><span>Personal workspace<small>Your creative space</small></span></div><button class="btn btn-primary sidebar-create" data-new>${icon('plus')}New presentation</button><nav class="side-nav" aria-label="Workspace">${navButton('all','All presentations','grid',items.length)}${navButton('starred','Starred','star',items.filter(d=>d.starred).length)}${navButton('templates','Templates','template')}</nav><div class="sidebar-bottom"><div class="canvas-tip"><span class="tip-orbits" aria-hidden="true"><i></i><i></i><i></i></span><h3>Think outside the slide.</h3><p>Connect your ideas on one big, beautiful canvas.</p><button class="text-button" data-template="${esc(TEMPLATES[0]?.id || 'blank')}">Give it a try ${icon('arrow')}</button></div><div class="storage-note"><span class="status-dot"></span><span>Saved in this browser<small>Export a copy to keep it safe.</small></span></div></div></aside><div class="dashboard-body"><header class="workspace-topbar"><div class="breadcrumbs"><span>Workspace</span>${icon('chevron')}<strong>${view==='templates'?'Templates':view==='starred'?'Starred':'Overview'}</strong></div><div class="topbar-right"><span class="internal-badge">Internal testing</span><span class="user-avatar" title="Your personal workspace">You</span></div></header><main class="dashboard-main"><div class="dashboard-intro"><div><span class="eyebrow">${view==='templates'?'THE TEMPLATE COLLECTION':view==='starred'?'YOUR FAVORITES':'A FRESH PERSPECTIVE'}</span><h1>${view==='templates'?'Every story starts somewhere.':view==='starred'?'Your brightest ideas, together.':'Your ideas, in motion.'}</h1><p>${view==='templates'?'Choose a canvas. Add your perspective. Make it memorable.':view==='starred'?'The presentations you want to keep within reach.':'Make something worth sharing. Start with a canvas, take it anywhere.'}</p></div>${view!=='templates'?`<button class="btn import-button" data-import>${icon('upload')}Import file</button>`:''}</div>${view==='all'?`<section class="creation-cards" aria-label="Create a presentation"><button class="create-canvas-card" data-new><div class="creation-copy"><span class="eyebrow">THE POSSIBILITIES ARE OPEN</span><h2>A blank canvas.<br>A bigger picture.</h2><span class="creation-link">Create a presentation ${icon('arrow')}</span></div><div class="canvas-illustration" aria-hidden="true"><div class="ill-ring ring-one"></div><div class="ill-ring ring-two"></div><div class="ill-sheet"><span></span><span></span><div><i></i><i></i><i></i></div></div><span class="ill-plus">+</span><span class="ill-dot"></span></div></button><button class="browse-templates-card" data-view="templates"><div class="template-illustration" aria-hidden="true"><div class="mini-slide mini-one"><i></i><span></span><span></span></div><div class="mini-slide mini-two"><i></i><span></span><span></span></div><div class="mini-slide mini-three"><i></i><span></span><span></span></div></div><div><h2>Skip the blank page.</h2><span class="creation-link">Start with a template ${icon('arrow')}</span></div></button></section>`:''}${view==='templates'?templatesContent():libraryContent()}${view==='all'?templatesContent(true):''}<footer class="dashboard-footer"><span>Small ideas become big stories.</span><span>Made with Dash Presentation ${logo}</span></footer></main></div></div>`;
    if (searchFocused) {
      const input = root.querySelector('#presentation-search');
      input?.focus();
      if (selectionStart !== null) { try { input.setSelectionRange(selectionStart,selectionStart); } catch {} }
    }
  }
  function closeDialog() { dialogEl?.close(); dialogEl?.remove(); dialogEl=null; }
  function showDialog(mode, deck) {
    activeMenu=null; paint();
    const previousFocus = root.querySelector(`[data-menu="${CSS.escape(deck.id)}"]`);
    const dialog = document.createElement('dialog'); dialog.className='dialog dashboard-dialog'; dialog.setAttribute('aria-labelledby','dash-dialog-title');
    const isDelete=mode==='delete';
    dialog.innerHTML=`<form method="dialog"><div class="dialog-heading"><span class="dialog-icon ${isDelete?'danger-text':''}">${icon(isDelete?'trash':'edit')}</span><button type="button" class="icon-btn" data-dismiss aria-label="Close dialog">${icon('close')}</button></div><h2 id="dash-dialog-title">${isDelete?'Delete this presentation?':'Give your story a name.'}</h2><p>${isDelete?`“${esc(deck.title)}” will be removed from this browser. This cannot be undone.`:'A clear name makes it easy to find later.'}</p>${isDelete?'':`<label class="field-label" for="deck-name">Presentation name</label><input class="dialog-input" id="deck-name" name="name" value="${esc(deck.title)}" maxlength="160" required autocomplete="off"><p class="field-error" hidden>Please enter a presentation name.</p>`}<div class="dialog-actions"><button type="button" class="btn" data-dismiss>Cancel</button><button type="submit" class="btn ${isDelete?'btn-danger':'btn-primary'}">${isDelete?'Delete presentation':'Save name'}</button></div></form>`;
    document.body.append(dialog); dialogEl=dialog;
    dialog.querySelectorAll('[data-dismiss]').forEach(b=>b.addEventListener('click',closeDialog));
    dialog.addEventListener('click',e=>{if(e.target===dialog) closeDialog();});
    dialog.addEventListener('close',()=>{if(dialogEl===dialog){dialog.remove();dialogEl=null;} previousFocus?.focus();});
    dialog.querySelector('form').addEventListener('submit',event=>{
      event.preventDefault();
      if(isDelete) { closeDialog(); commit(items.filter(d=>d.id!==deck.id)); showToast('Presentation deleted'); }
      else {
        const value=dialog.querySelector('#deck-name').value.trim();
        if(!value){dialog.querySelector('.field-error').hidden=false;dialog.querySelector('#deck-name').focus();return;}
        closeDialog(); commit(items.map(d=>d.id===deck.id?{...d,title:value,updatedAt:new Date().toISOString()}:d)); showToast('Presentation renamed');
      }
    });
    dialog.showModal();
    if(!isDelete){ const input=dialog.querySelector('#deck-name'); input.focus();input.select(); }
  }
  root.addEventListener('click', event => {
    const target=event.target.closest('button'); if(!target) return;
    const d=target.dataset;
    if('new' in d) return onCreate('blank');
    if(d.template) return onCreate(d.template);
    if(d.open) return onOpen(d.open);
    if('import' in d) return onImport();
    if(d.view) {view=d.view;query='';activeMenu=null;category='All';paint();return;}
    if(d.category) {category=d.category;paint();return;}
    if(d.layout) {layout=d.layout;activeMenu=null;paint();return;}
    if('clearSearch' in d) {query='';paint();return;}
    if(d.menu) {activeMenu=activeMenu===d.menu?null:d.menu;paint();if(activeMenu)root.querySelector(`[data-deck="${CSS.escape(activeMenu)}"] [role="menuitem"]`)?.focus();return;}
    if(d.star) {commit(items.map(x=>x.id===d.star?{...x,starred:!x.starred}:x));root.querySelector(`[data-star="${CSS.escape(d.star)}"]`)?.focus();return;}
    if(d.duplicate) {const deck=items.find(x=>x.id===d.duplicate);if(deck){activeMenu=null;commit([cloneDeck(deck),...items]);showToast('A copy is ready in your workspace');}return;}
    if(d.rename || d.delete) {const deck=items.find(x=>x.id===(d.rename||d.delete));if(deck)showDialog(d.delete?'delete':'rename',deck);}
  },{signal});
  root.addEventListener('input',event=>{if(event.target.id==='presentation-search'){query=event.target.value;activeMenu=null;paint();}},{signal});
  root.addEventListener('change',event=>{if(event.target.id==='presentation-sort'){sort=event.target.value;activeMenu=null;paint();}},{signal});
  document.addEventListener('click',event=>{if(activeMenu&&!event.target.closest('.card-menu-wrap')){activeMenu=null;paint();}},{signal});
  document.addEventListener('keydown',event=>{if(activeMenu&&event.target.closest('[role="menu"]')&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const buttons=[...event.target.closest('[role="menu"]').querySelectorAll('[role="menuitem"]')];const current=buttons.indexOf(event.target);const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();return;}if(event.key==='Escape'&&activeMenu){const id=activeMenu;activeMenu=null;paint();root.querySelector(`[data-menu="${CSS.escape(id)}"]`)?.focus();}},{signal});
  paint();
  return () => {destroyed=true;signalController.abort();closeDialog();};
}
