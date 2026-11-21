/** Dash Presentation's portable document model and browser-local repository. */
export const STORAGE_KEY = 'orbit-studio.documents.v1';
export const THEMES = Object.freeze([
  { id: 'forest', name: 'Forest', bg: '#eff3e9', ink: '#183e32', accent: '#245c48', soft: '#d8eea3' },
  { id: 'peach', name: 'Apricot', bg: '#fff0e6', ink: '#643e31', accent: '#a84d2f', soft: '#ffcba7' },
  { id: 'ocean', name: 'Ocean', bg: '#eaf1f4', ink: '#243f51', accent: '#365c76', soft: '#bfdde7' },
  { id: 'lilac', name: 'Lavender', bg: '#f0edf8', ink: '#49375f', accent: '#725292', soft: '#d8c9ee' },
]);
export const TEMPLATES = Object.freeze([
  { id: 'blank', name: 'A fresh canvas', category: 'Essentials', description: 'Make space for an idea of your own.', theme: 'forest' },
  { id: 'strategy', name: 'The big picture', category: 'Business', description: 'Connect your ambition to the next practical step.', theme: 'forest' },
  { id: 'pitch', name: 'A compelling pitch', category: 'Business', description: 'A simple path from opportunity to possibility.', theme: 'peach' },
  { id: 'lesson', name: 'A little discovery', category: 'Education', description: 'Turn a new concept into a memorable journey.', theme: 'ocean' },
  { id: 'project', name: 'From idea to impact', category: 'Business', description: 'Bring the team along for what comes next.', theme: 'lilac' },
  { id: 'story', name: 'Tell your story', category: 'Creative', description: 'Set the scene. Find the turning point. Leave a mark.', theme: 'peach' },
]);

const DOCUMENT_LIMIT = 100;
const NODE_LIMIT = 150;
const MAX_BYTES = 4_000_000;
const idPattern = /^[A-Za-z0-9_-]{1,100}$/;
const hexPattern = /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i;
const templateContent = {
  strategy: {
    title: 'The next chapter', subtitle: 'A shared direction. A clear path forward.',
    topics: [
      ['Where we are', 'Start with what matters today.', 'Share a brief snapshot of the current landscape. Invite the team to name one strength worth keeping.', 'Our strengths', 'What we know'],
      ['Where we’re going', 'Give the next chapter a purpose.', 'Describe the change you want to see. Make the desired outcome concrete enough that everyone can picture it.', 'The opportunity', 'Our ambition'],
      ['How we get there', 'Turn possibility into progress.', 'Choose the first practical step, agree on ownership, and leave space for learning along the way.', 'First steps', 'Success signals'],
    ],
  },
  pitch: {
    title: 'A brighter way forward', subtitle: 'One opportunity. A different perspective.',
    topics: [
      ['The opportunity', 'There is a better way to begin.', 'Describe the real problem and the people experiencing it. Add your own evidence before sharing externally.', 'The friction', 'Who it helps'],
      ['The idea', 'Small changes can open big doors.', 'Explain your idea in a single sentence. Show how it improves the experience for the people you serve.', 'Our approach', 'Why it works'],
      ['What comes next', 'Let’s build something meaningful.', 'Name the next milestone and the support needed to reach it. Leave time for questions.', 'A first version', 'The invitation'],
    ],
  },
  lesson: {
    title: 'Small ideas. Big impact.', subtitle: 'Follow your curiosity. See how it all connects.',
    topics: [
      ['Start with a question', 'Curiosity is a useful starting point.', 'Ask learners what they already know. Allow a quiet moment for individual reflection before discussing.', 'What we notice', 'What we wonder'],
      ['Explore the idea', 'Look closer. Make a connection.', 'Introduce the concept with an everyday example, then invite learners to connect it to their own experience.', 'A closer look', 'Try it together'],
      ['Make it your own', 'Turn understanding into action.', 'Ask learners to explain the idea in their own words and suggest one way to apply it.', 'Your example', 'One takeaway'],
    ],
  },
  project: {
    title: 'From idea to impact', subtitle: 'A project worth bringing to life.',
    topics: [
      ['The purpose', 'Give the work a reason to exist.', 'Align the team on the problem, the audience, and the intended outcome.', 'Our goal', 'Who it serves'],
      ['The plan', 'Make the next step visible.', 'Walk through milestones, dependencies, and ownership. Discuss where the team needs support.', 'Milestones', 'Working together'],
      ['The outcome', 'Learn from what changes.', 'Agree on signals of progress and a review cadence. Capture lessons as the project develops.', 'What to measure', 'What to learn'],
    ],
  },
  story: {
    title: 'Every idea has a story', subtitle: 'Take your audience somewhere new.',
    topics: [
      ['Set the scene', 'Begin with a moment that matters.', 'Introduce the context and the people at the heart of the story.', 'The beginning', 'The people'],
      ['Find the turning point', 'Something changes. A possibility opens.', 'Describe the challenge and the decision that moved the story forward.', 'The challenge', 'The choice'],
      ['Leave a lasting thought', 'Bring the journey back to its meaning.', 'Share what changed, what was learned, and what the audience can take with them.', 'What changed', 'What stays'],
    ],
  },
};

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
function cleanText(value, field, max, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || value.length > max) throw new Error(`${field} must be text with at most ${max} characters.`);
  return value.replace(/\u0000/g, '');
}
function identifier(value, field) {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new Error(`${field} is not a valid identifier.`);
  return value;
}
function finiteNumber(value, field, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${field} must be a number between ${min} and ${max}.`);
  return Math.round(value * 1000) / 1000;
}
function isoDate(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || value.length > 50 || !Number.isFinite(Date.parse(value))) throw new Error('Presentation dates are invalid.');
  return new Date(value).toISOString();
}

/** Validate and copy only known fields; imported strings are rendered as text by the UI. */
export function validateDeck(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('This file does not contain a presentation object.');
  const now = new Date().toISOString();
  const id = identifier(data.id, 'Presentation ID');
  const title = cleanText(data.title, 'Presentation title', 180, 'Untitled presentation');
  const theme = THEMES.some(t => t.id === data.theme) ? data.theme : 'forest';
  if (!Array.isArray(data.nodes) || data.nodes.length > NODE_LIMIT) throw new Error(`A presentation must contain no more than ${NODE_LIMIT} topics.`);
  const ids = new Set();
  const nodes = data.nodes.map((node, i) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error(`Topic ${i + 1} is invalid.`);
    const nodeId = identifier(node.id, 'Topic ID');
    if (ids.has(nodeId)) throw new Error('Topic IDs must be unique.');
    ids.add(nodeId);
    const color = node.color ?? THEMES.find(t => t.id === theme).soft;
    if (typeof color !== 'string' || !hexPattern.test(color)) throw new Error('Topic colors must be valid hexadecimal colors.');
    return {
      id: nodeId,
      title: cleanText(node.title, 'Topic title', 180, 'Untitled topic'),
      body: cleanText(node.body, 'Topic body', 4000),
      notes: cleanText(node.notes, 'Presenter notes', 12000),
      x: finiteNumber(node.x, 'Topic x position', -20000, 20000),
      y: finiteNumber(node.y, 'Topic y position', -20000, 20000),
      w: finiteNumber(node.w, 'Topic width', 40, 5000),
      h: finiteNumber(node.h, 'Topic height', 40, 5000),
      parentId: node.parentId == null ? null : identifier(node.parentId, 'Parent topic ID'),
      color: color.toLowerCase(),
    };
  });
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (const node of nodes) {
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent !== null) {
      if (!nodeMap.has(parent)) throw new Error('A topic refers to a missing parent.');
      if (seen.has(parent)) throw new Error('Topic parents cannot form a cycle.');
      seen.add(parent);
      if (seen.size > 12) throw new Error('This presentation has too many nested topic levels.');
      parent = nodeMap.get(parent).parentId;
    }
  }
  if (!Array.isArray(data.path) || data.path.length !== nodes.length) throw new Error('The presentation path must include every topic exactly once.');
  const path = data.path.map(v => identifier(v, 'Path topic ID'));
  if (new Set(path).size !== path.length || path.some(v => !ids.has(v))) throw new Error('The presentation path contains a duplicate or missing topic.');
  return {
    id, title: title.trim() || 'Untitled presentation',
    subtitle: cleanText(data.subtitle, 'Presentation subtitle', 700),
    theme, starred: data.starred === true,
    createdAt: isoDate(data.createdAt, now), updatedAt: isoDate(data.updatedAt, now),
    nodes, path,
  };
}

export function createDeck(templateId = 'blank', title) {
  const template = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0];
  const content = templateContent[template.id];
  const now = new Date().toISOString();
  const nodes = [];
  const path = [];
  const colors = {
    forest: ['#d8eea3', '#c6dfd0', '#f0dfbd'], peach: ['#ffcba7', '#f5dba2', '#e3c6bc'],
    ocean: ['#bfdde7', '#d1d6ef', '#d9e4c3'], lilac: ['#d8c9ee', '#e7cddc', '#d6e0c7'],
  }[template.theme];
  if (content) {
    const points = [[110, 400], [610, 330], [1110, 440]];
    content.topics.forEach((topic, i) => {
      const id = uid();
      const [x, y] = points[i];
      nodes.push({ id, title: topic[0], body: topic[1], notes: topic[2], x, y, w: 400, h: 280, parentId: null, color: colors[i] });
      path.push(id);
      for (let childIndex = 0; childIndex < 2; childIndex++) {
        const childId = uid();
        nodes.push({ id: childId, title: topic[3 + childIndex], body: '', notes: `Add your own example for “${topic[3 + childIndex]}”.`, x: x + 28 + childIndex * 185, y: y + 165, w: 145, h: 95, parentId: id, color: '#ffffff' });
        path.push(childId);
      }
    });
  }
  return validateDeck({
    id: uid(), title: title ?? content?.title ?? 'Untitled presentation',
    subtitle: content?.subtitle ?? 'A little space for your next big idea.',
    theme: template.theme, starred: false, createdAt: now, updatedAt: now, nodes, path,
  });
}

function storage() {
  try {
    if (!globalThis.localStorage) throw new Error('unavailable');
    return globalThis.localStorage;
  } catch {
    throw new Error('Browser storage is unavailable. Export your presentation to keep a copy.');
  }
}
function checkedDecks(decks) {
  if (!Array.isArray(decks) || decks.length > DOCUMENT_LIMIT) throw new Error(`This workspace supports up to ${DOCUMENT_LIMIT} presentations.`);
  const checked = decks.map(validateDeck);
  if (new Set(checked.map(d => d.id)).size !== checked.length) throw new Error('Presentation IDs must be unique.');
  return checked;
}
export function saveDecks(decks) {
  const checked = checkedDecks(decks);
  const serialized = JSON.stringify({ version: 1, decks: checked });
  if (serialized.length > MAX_BYTES) throw new Error('This workspace is full. Export some presentations and remove them before saving.');
  try { storage().setItem(STORAGE_KEY, serialized); }
  catch (error) {
    if (error?.name === 'QuotaExceededError') throw new Error('Browser storage is full. Export your work before closing this page.');
    throw new Error(error?.message?.includes('unavailable') ? error.message : 'Could not save to this browser. Export your work before closing this page.');
  }
  return checked;
}
export function loadDecks() {
  const repository = storage();
  let raw;
  try { raw = repository.getItem(STORAGE_KEY); }
  catch { throw new Error('Browser storage could not be read. Your saved data has not been changed.'); }
  if (raw === null) {
    const decks = [createDeck('strategy'), createDeck('pitch'), createDeck('lesson')];
    decks[0].starred = true;
    const now = Date.now();
    decks.forEach((deck, i) => { deck.updatedAt = new Date(now - i * 86400000).toISOString(); });
    saveDecks(decks);
    return decks;
  }
  if (raw.length > MAX_BYTES) throw new Error('Saved workspace data is too large to open. Your saved data has not been changed.');
  try {
    const parsed = JSON.parse(raw);
    // Array support keeps an earlier development export readable.
    const decks = Array.isArray(parsed) ? parsed : parsed?.version === 1 ? parsed.decks : null;
    return checkedDecks(decks);
  } catch (error) {
    throw new Error(`Saved workspace data could not be opened. Your saved data has not been changed. ${error.message}`);
  }
}
