const SUPABASE_URL = 'https://ymnsoxqizbzexfalefvj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZAyhNnpEWE6K2YpwS7-BJA_Yp0xU6T2';
const MEDIA_URL = 'https://dash-presentation-media.debdblr.workers.dev';
const SESSION_KEY = 'dash-presentation.session.v1';

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function writeSession(session) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify({
    ...session,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in,
  }));
}

async function authRequest(path, body) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.msg || result.message || 'Account request failed.');
  return result;
}

export async function session() {
  const current = readSession();
  if (!current?.refresh_token) return null;
  if (current.expires_at > Math.floor(Date.now() / 1000) + 60) return current;
  try {
    const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: current.refresh_token });
    writeSession(refreshed);
    return refreshed;
  } catch {
    writeSession(null);
    return null;
  }
}

export async function signIn(email, password) {
  const result = await authRequest('token?grant_type=password', { email, password });
  writeSession(result);
  return result;
}

export async function signUp(email, password) {
  const result = await authRequest('signup', { email, password });
  if (result.access_token) writeSession(result);
  return result;
}

export async function signOut() {
  const current = await session();
  if (current?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${current.access_token}` },
    }).catch(() => {});
  }
  writeSession(null);
}

async function mediaRequest(path, options = {}) {
  const current = await session();
  if (!current?.access_token) throw new Error('Sign in to use private file storage.');
  const response = await fetch(`${MEDIA_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${current.access_token}`, ...options.headers },
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.error || 'The storage request failed.');
  }
  return response;
}

export async function storageUsage() {
  return (await mediaRequest('/usage')).json();
}

export async function uploadFile(file, presentationId) {
  const response = await mediaRequest('/upload', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Size': String(file.size),
      ...(presentationId ? { 'X-Presentation-Id': presentationId } : {}),
    },
    body: file,
  });
  return (await response.json()).asset;
}

export async function mediaObjectUrl(assetId) {
  return URL.createObjectURL(await (await mediaRequest(`/media/${encodeURIComponent(assetId)}`)).blob());
}

export async function deleteFile(assetId) {
  await mediaRequest(`/media/${encodeURIComponent(assetId)}`, { method: 'DELETE' });
}
