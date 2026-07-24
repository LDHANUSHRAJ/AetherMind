/**
 * supabase_client.js — AetherMind data layer
 *
 * Schema (per supabase/schema.sql — treat as authoritative):
 *   profiles       — id (PK, references auth.users), full_name, avatar_url, email, member_id, joined_at
 *   user_settings  — user_id (PK), temperature, token_limit, theme, daily_goal, focus_domains, ollama_url
 *   chat_sessions  — id, user_id, title, is_pinned, created_at, updated_at
 *   messages       — id, session_id, role ('user'|'assistant'), content, created_at
 *   query_logs     — id, user_id, domain, tokens_used, response_quality, created_at (analytics only,
 *                    no session_id/role/content/is_verified columns)
 *
 * Credentials are read from window.__AM_ENV (injected by env-loader.js at startup).
 * Falls back to localStorage for every operation when Supabase is unreachable (EX-6).
 */

console.log("window.__SUPABASE_URL__ =", window.__SUPABASE_URL__);
console.log("window.__SUPABASE_ANON_KEY__ =", window.__SUPABASE_ANON_KEY__);
console.log("window.__AM_ENV =", window.__AM_ENV);

// ── Credential bootstrap ─────────────────────────────────────────────────────
// env-loader.js reads .env at dev-server startup and sets window.__AM_ENV.
// In production, replace with your build tool's env injection.
const _env = (typeof window !== 'undefined' && window.__AM_ENV) || {};
const SUPABASE_URL     = _env.SUPABASE_URL     || window.__SUPABASE_URL__ || '';
const SUPABASE_ANON_KEY = _env.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY__ || '';
const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('YOUR_') && !SUPABASE_ANON_KEY.includes('YOUR_'));

// Session storage adapter that honors "remember me": when am_remember is '0'
// the session token lives in sessionStorage (cleared when the tab/browser
// closes) instead of localStorage (persists ~30 days via refresh token).
// The flag is written by signIn() *before* the SDK persists the token, so
// this adapter's getItem/setItem always land in the right place.
function _rememberEnabled() {
  try { return localStorage.getItem('am_remember') !== '0'; } catch (e) { return true; }
}
const _rememberAwareStorage = {
  getItem(key) {
    try { return _rememberEnabled() ? localStorage.getItem(key) : sessionStorage.getItem(key); } catch (e) { return null; }
  },
  setItem(key, value) {
    try { (_rememberEnabled() ? localStorage : sessionStorage).setItem(key, value); } catch (e) {}
  },
  removeItem(key) {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch (e) {}
  },
};

let _sb = null;
function getSB() {
  if (!CONFIGURED) return null;
  if (!_sb && window.supabase) {
    try {
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          storageKey: 'am_session',
          storage: _rememberAwareStorage,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (e) {}
  }
  return _sb;
}

// ── EX-6: sync-status indicator ──────────────────────────────────────────────
let _offline = false;
function setSyncStatus(offline) {
  if (_offline === offline) return;
  _offline = offline;
  let bar = document.getElementById('am-sync-bar');
  if (offline) {
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'am-sync-bar';
      bar.style.cssText = [
        'position:fixed;top:0;left:0;right:0;z-index:9999',
        'background:var(--amber,#f5b942);color:#000',
        'text-align:center;padding:7px;font-size:12.5px;font-weight:600',
        'font-family:Hanken Grotesk,sans-serif',
      ].join(';');
      bar.textContent = '⚠ Offline — changes saved locally and will sync when Supabase reconnects';
      document.body.prepend(bar);
    }
  } else if (bar) {
    bar.remove();
  }
}

function isNetErr(err) {
  return err && (
    err.message?.includes('Failed to fetch') ||
    err.message?.includes('NetworkError') ||
    err.code === 'NETWORK_ERROR' ||
    err.status === 0
  );
}

// ── localStorage helpers (EX-6 fallback) ─────────────────────────────────────
function _uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function _lsGet(key)       { try { return JSON.parse(localStorage.getItem('am_' + key) || 'null'); } catch { return null; } }
function _lsSet(key, val)  { try { localStorage.setItem('am_' + key, JSON.stringify(val)); } catch {} }
function _lsList(key)      { return _lsGet(key) || []; }

// ── AUTH ─────────────────────────────────────────────────────────────────────

async function getSession() {
  const sb = getSB();
  if (sb) {
    const { data } = await sb.auth.getSession().catch(() => ({ data: null }));
    if (data?.session) return data.session;
    // No live Supabase session — e.g. signup/login happened while offline and
    // fell back to a local session (EX-6). Don't strand the user on auth.html.
  }
  return _lsGet('local_session');
}

/** Redirect to auth page if no valid session. Call at top of every protected page. */
async function requireAuth() {
  const session = await getSession();
  if (!session) { window.location.href = 'auth.html'; return null; }
  return session;
}

/** Redirect away from auth page if already signed in. */
async function redirectIfAuthed() {
  const session = await getSession();
  if (session) { window.location.href = 'index.html'; return true; }
  return false;
}

async function signUp(email, password, fullName) {
  const sb = getSB();
  if (sb) {
    try {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw new Error(error.message);
      setSyncStatus(false);
      return { success: true, user: data.user };
    } catch (err) {
      if (!isNetErr(err)) throw err;
      setSyncStatus(true);
    }
  }
  // Local fallback
  const uid = _uuid();
  _lsSet('local_profile', { id: uid, user_id: uid, full_name: fullName, avatar_url: null });
  _lsSet('local_session', { access_token: 'local', user: { id: uid, email, user_metadata: { full_name: fullName } } });
  return { success: true, user: { id: uid, email, user_metadata: { full_name: fullName } } };
}

async function signIn(email, password, rememberMe = true) {
  try { localStorage.setItem('am_remember', rememberMe ? '1' : '0'); } catch (e) {}
  const sb = getSB();
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);   // always surface auth errors
    setSyncStatus(false);
    return { success: true, session: data.session };
  }
  // Local fallback — accept any password for offline demo
  const session = { access_token: 'local', user: { id: _uuid(), email, user_metadata: { full_name: email.split('@')[0] } } };
  _lsSet('local_session', session);
  return { success: true, session };
}

async function signOut() {
  const sb = getSB();
  if (sb) await sb.auth.signOut().catch(() => {});
  _lsSet('local_session', null);
  window.location.href = 'auth.html';
}

async function updatePassword(newPassword) {
  const sb = getSB();
  if (!sb) throw new Error('Supabase not configured');
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/** Kick off Google OAuth sign-in via Supabase. Requires the Google provider to be
 *  enabled in the Supabase dashboard (Authentication → Providers) — that's a
 *  hosted config step outside this codebase's control. */
async function signInWithGoogle() {
  const sb = getSB();
  if (!sb) throw new Error('Supabase not configured');
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/index.html' },
  });
  if (error) throw new Error(error.message);
}

/** Full cascade delete: query_logs, chat_sessions (+messages via FK) → user_settings → profiles → auth user */
async function deleteAccount() {
  const session = await getSession();
  if (!session) return;
  const uid = session.user?.id;
  const sb = getSB();
  if (sb && uid) {
    // RLS ensures each delete only touches own rows
    await sb.from('query_logs').delete().eq('user_id', uid).catch(() => {});
    await sb.from('chat_sessions').delete().eq('user_id', uid).catch(() => {});
    await sb.from('user_settings').delete().eq('user_id', uid).catch(() => {});
    await sb.from('profiles').delete().eq('id', uid).catch(() => {});
    await sb.auth.admin?.deleteUser(uid).catch(() => {}); // requires service role in edge fn
    await sb.auth.signOut().catch(() => {});
  }
  ['local_session','local_profile','local_settings','local_sessions','local_logs']
    .forEach(k => localStorage.removeItem('am_' + k));
  window.location.href = 'auth.html';
}

// ── PROFILES ─────────────────────────────────────────────────────────────────

async function loadProfile(userId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
      if (data) { setSyncStatus(false); return data; }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  return _lsGet('local_profile') || { user_id: userId, full_name: '', avatar_url: null };
}

async function updateProfile(userId, updates) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('profiles')
        .upsert({ id: userId, ...updates }, { onConflict: 'id' })
        .select().single();
      setSyncStatus(false);
      if (updates.full_name) await sb.auth.updateUser({ data: { full_name: updates.full_name } }).catch(() => {});
      return data;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const p = _lsGet('local_profile') || { user_id: userId };
  Object.assign(p, updates);
  _lsSet('local_profile', p);
  return p;
}

/** Upload a profile photo to the 'avatars' Storage bucket and persist the
 *  resulting public URL on the profile. Returns the new avatar_url, or null
 *  when Supabase isn't configured/reachable (EX-6 — no local-file fallback,
 *  since there's nowhere durable to store a blob offline). */
async function uploadAvatar(userId, file) {
  const sb = getSB();
  if (!sb) throw new Error('Supabase not configured — cannot upload photo offline.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/avatar.${ext}`;
  const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true });
  if (upErr) throw new Error(upErr.message);
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  const url = data.publicUrl + '?t=' + Date.now(); // bust CDN/browser cache on re-upload
  await updateProfile(userId, { avatar_url: url });
  return url;
}

// ── USER SETTINGS ─────────────────────────────────────────────────────────────

const SETTINGS_DEFAULTS = {
  temperature: 0.2,
  token_limit: 2048,
  theme: 'dark',
  daily_goal: 20,
  focus_domains: ['Mathematics', 'Code'],
  ollama_url: 'http://localhost:11434',
};

async function loadSettings(userId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('user_settings').select('*').eq('user_id', userId).single();
      if (data) { setSyncStatus(false); return { ...SETTINGS_DEFAULTS, ...data }; }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  return { ...SETTINGS_DEFAULTS, ...(_lsGet('local_settings') || {}) };
}

async function saveSettings(userId, patch) {
  const sb = getSB();
  if (sb) {
    try {
      await sb.from('user_settings')
        .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
      setSyncStatus(false);
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const s = _lsGet('local_settings') || {};
  Object.assign(s, patch);
  _lsSet('local_settings', s);
}

// ── THEME ────────────────────────────────────────────────────────────────────

/** Apply the persisted theme to the document. Mirrors the inline bootstrap
 *  pattern used in index.html/auth.html (localStorage 'aether-theme'), but
 *  also consults user_settings.dark_mode when a session/userId is available,
 *  so the theme follows the account rather than just the browser. */
async function initTheme(userId) {
  let theme = null;
  try { theme = localStorage.getItem('aether-theme'); } catch (e) {}
  if (!theme) {
    try {
      const uid = userId || (await getSession())?.user?.id;
      if (uid) {
        const s = await loadSettings(uid);
        theme = typeof s.dark_mode === 'boolean' ? (s.dark_mode ? 'dark' : 'light') : (s.theme || 'dark');
      }
    } catch (e) {}
  }
  theme = theme || 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('aether-theme', theme); } catch (e) {}
  return theme;
}

// ── CHAT SESSIONS ─────────────────────────────────────────────────────────────

// Map a chat_sessions row coming from Supabase (is_pinned) to the shape the
// frontend expects everywhere else (pinned), so callers never see is_pinned.
function _mapSessionFromDb(row) {
  if (!row) return row;
  const { is_pinned, ...rest } = row;
  return { ...rest, pinned: !!is_pinned };
}

async function loadSessions(userId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('chat_sessions')
        .select('*').eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (data) { setSyncStatus(false); return data.map(_mapSessionFromDb); }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  return _lsList('local_sessions');
}

async function createSession(userId, title = 'New session') {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('chat_sessions')
        .insert({ user_id: userId, title }).select().single();
      setSyncStatus(false);
      return _mapSessionFromDb(data);
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const s = { id: _uuid(), user_id: userId, title, pinned: false,
               created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const list = _lsList('local_sessions');
  list.unshift(s);
  _lsSet('local_sessions', list);
  return s;
}

async function updateSession(userId, sessionId, patch) {
  const sb = getSB();
  if (sb) {
    try {
      // Translate the frontend's `pinned` field to the DB's `is_pinned` column.
      const dbPatch = { ...patch };
      if ('pinned' in dbPatch) { dbPatch.is_pinned = dbPatch.pinned; delete dbPatch.pinned; }
      const { data } = await sb.from('chat_sessions')
        .update(dbPatch).eq('id', sessionId).eq('user_id', userId)
        .select().single();
      setSyncStatus(false);
      return _mapSessionFromDb(data);
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const list = _lsList('local_sessions');
  const idx = list.findIndex(s => s.id === sessionId);
  if (idx !== -1) Object.assign(list[idx], patch);
  _lsSet('local_sessions', list);
  return list[idx];
}

async function deleteSession(userId, sessionId) {
  const sb = getSB();
  if (sb) {
    try {
      // messages cascade-delete via FK (messages.session_id -> chat_sessions); no separate delete needed
      await sb.from('chat_sessions').delete().eq('id', sessionId).eq('user_id', userId);
      setSyncStatus(false);
      return;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  _lsSet('local_sessions', _lsList('local_sessions').filter(s => s.id !== sessionId));
  // remove local logs for this session
  localStorage.removeItem('am_logs_' + sessionId);
}

// ── MESSAGES (chat content) + QUERY LOGS (analytics) ─────────────────────────

async function loadMessages(sessionId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('messages')
        .select('*').eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (data) { setSyncStatus(false); return data; }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  return _lsList('logs_' + sessionId);
}

async function appendMessage(userId, sessionId, role, content, meta = {}) {
  // meta: { domain, tokens_used, is_verified }
  // messages.role has a DB check constraint of 'user' | 'assistant' — normalize
  // any other frontend role naming (e.g. 'ai', 'err') to 'assistant'.
  const dbRole = (role === 'user') ? 'user' : 'assistant';
  const row = { session_id: sessionId, role: dbRole, content };
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('messages').insert(row).select().single();
      setSyncStatus(false);
      // Analytics: log this query separately in query_logs (not linked to session_id).
      await sb.from('query_logs').insert({
        user_id: userId,
        domain: meta.domain || null,
        tokens_used: meta.tokens_used || 0,
        response_quality: meta.is_verified ? 'excellent' : 'good',
      }).catch(() => {});
      // bump session updated_at
      await sb.from('chat_sessions').update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId).eq('user_id', userId).catch(() => {});
      return data;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const entry = { id: _uuid(), user_id: userId, session_id: sessionId, role, content,
                  domain: meta.domain || null,
                  tokens_used: meta.tokens_used || 0,
                  is_verified: meta.is_verified || false,
                  created_at: new Date().toISOString() };
  const list = _lsList('logs_' + sessionId);
  list.push(entry);
  _lsSet('logs_' + sessionId, list);
  return entry;
}

// ── STUDY PLAN (study_topics) ─────────────────────────────────────────────────

async function loadStudyTopics(userId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('study_topics')
        .select('*').eq('user_id', userId)
        .order('status', { ascending: true })
        .order('order_index', { ascending: true });
      if (data) { setSyncStatus(false); return data; }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  return _lsList('local_topics');
}

async function addStudyTopic(userId, title) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('study_topics')
        .insert({ user_id: userId, title, status: 'active' }).select().single();
      setSyncStatus(false);
      return data;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const t = { id: _uuid(), user_id: userId, title, status: 'active', is_focus: false,
              order_index: 0, created_at: new Date().toISOString() };
  const list = _lsList('local_topics');
  list.push(t);
  _lsSet('local_topics', list);
  return t;
}

async function updateStudyTopic(userId, topicId, patch) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('study_topics')
        .update(patch).eq('id', topicId).eq('user_id', userId).select().single();
      setSyncStatus(false);
      return data;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const list = _lsList('local_topics');
  const idx = list.findIndex(t => t.id === topicId);
  if (idx !== -1) Object.assign(list[idx], patch);
  _lsSet('local_topics', list);
  return list[idx];
}

async function deleteStudyTopic(userId, topicId) {
  const sb = getSB();
  if (sb) {
    try {
      await sb.from('study_topics').delete().eq('id', topicId).eq('user_id', userId);
      setSyncStatus(false);
      return;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  _lsSet('local_topics', _lsList('local_topics').filter(t => t.id !== topicId));
}

// ── DASHBOARD ANALYTICS ───────────────────────────────────────────────────────

async function loadDashboard(userId) {
  const sb = getSB();
  let logs = [];
  if (sb) {
    try {
      // query_logs has a direct user_id column (no session_id) — filter on it directly.
      const { data } = await sb.from('query_logs')
        .select('domain,tokens_used,response_quality,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (data) { logs = data; setSyncStatus(false); }
    } catch (err) {
      if (isNetErr(err)) { setSyncStatus(true); }
    }
  }
  if (!logs.length) {
    // Aggregate from local logs across all sessions
    const sessIds = _lsList('local_sessions').map(s => s.id);
    for (const sid of sessIds) {
      logs.push(..._lsList('logs_' + sid));
    }
  }

  const total = logs.length;
  const tokens = logs.reduce((s, l) => s + (l.tokens_used || 0), 0);
  const verified = logs.filter(l => l.response_quality === 'excellent').length;
  const accuracy = total ? Math.round(verified / total * 100) : 0;

  // Quality breakdown (schema's query_logs.response_quality is a 3-value enum)
  const qualityCounts = {
    excellent: logs.filter(l => l.response_quality === 'excellent').length,
    good: logs.filter(l => l.response_quality === 'good').length,
    poor: logs.filter(l => l.response_quality === 'poor').length,
  };

  // 14-day bar chart
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const bars = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today - (13 - i) * 86400000);
    const dstr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1);
    const count = logs.filter(l => (l.created_at || '').startsWith(dstr)).length;
    return { label, count };
  });
  const maxBar = Math.max(...bars.map(b => b.count), 1);
  const barsWithPct = bars.map(b => ({ ...b, pct: Math.round(b.count / maxBar * 100) || 2 }));

  // 28-day heatmap
  const heatmap = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today - (27 - i) * 86400000);
    const dstr = d.toISOString().slice(0, 10);
    const q = logs.filter(l => (l.created_at || '').startsWith(dstr)).length;
    const bg = q === 0 ? 'var(--border)' : q < 3 ? 'rgba(124,92,255,.25)' :
               q < 6 ? 'rgba(124,92,255,.5)' : q < 10 ? 'rgba(124,92,255,.75)' : 'var(--violet)';
    return { bg, title: `${q} queries on ${dstr}` };
  });

  // Streak
  let streak = 0;
  for (let d = 0; d < 365; d++) {
    const dstr = new Date(today - d * 86400000).toISOString().slice(0, 10);
    if (logs.some(l => (l.created_at || '').startsWith(dstr))) streak++;
    else break;
  }

  // Domain breakdown
  const domMap = {};
  logs.forEach(l => { if (l.domain) domMap[l.domain] = (domMap[l.domain] || 0) + 1; });
  const domColors = {
    Mathematics: 'var(--violet-2)',
    Code: 'var(--aether)',
    Statistics: 'var(--amber,#f5b942)',
    'General STEM': 'var(--text-faint)',
  };
  const domains = Object.entries(domMap)
    .map(([label, n]) => ({ label, pct: Math.round(n / total * 100), color: domColors[label] || 'var(--violet)' }))
    .sort((a, b) => b.pct - a.pct);

  // Recent sessions (last 5)
  const sessions = await loadSessions(userId);
  // query_logs no longer has a session_id column, so per-session token totals
  // aren't derivable from it — show '—' instead of fabricating a number.
  const recentSessions = sessions.slice(0, 5).map(s => ({
    title: s.title,
    domain: domMap[Object.keys(domMap)[0]] ? Object.keys(domMap)[0] : '—',
    tokens: '—',
    date: new Date(s.updated_at || s.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    tagBg: 'var(--violet-soft)', tagColor: 'var(--violet-2)',
  }));

  return { total, tokens, accuracy, streak, bars: barsWithPct, heatmap, domains, recentSessions, qualityCounts };
}

// ── PROFILE PAGE (composed view: profile row + dashboard stats) ──────────────

async function loadProfileData(userId) {
  const [profile, dash] = await Promise.all([loadProfile(userId), loadDashboard(userId)]);
  const strongest = dash.domains[0]?.label || 'N/A';
  const weakest = dash.domains[dash.domains.length - 1]?.label || 'N/A';
  return {
    full_name: profile.full_name || '',
    email: profile.email || '',
    joined: profile.joined_at ? new Date(profile.joined_at).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : 'N/A',
    member_id: profile.member_id || 'N/A',
    learningStreak: dash.streak,
    totalQueries: dash.total,
    strongestDomain: strongest,
    needsImprovement: dash.domains.length > 1 ? weakest : 'N/A',
    // No error/mistake-tracking table exists in the schema — nothing real to show here.
    mistakes: [],
  };
}

// ── SESSION MANAGEMENT ────────────────────────────────────────────────────────

/** Sign out every session except the current one (Supabase v2 'others' scope). */
async function signOutAllDevices() {
  const sb = getSB();
  if (sb) {
    const { error } = await sb.auth.signOut({ scope: 'others' });
    if (error) throw new Error(error.message);
    return;
  }
  // No concept of "other devices" in the localStorage fallback — nothing to do.
}

// ── PRACTICE PROBLEMS (Phase 3.2) ────────────────────────────────────────────

async function savePracticeAttempt(userId, record) {
  // record: { domain, difficulty, problem, verified_solution, full_solution,
  //           student_answer, is_correct, error_type }
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('practice_problems')
        .insert({ user_id: userId, ...record }).select().single();
      setSyncStatus(false);
      return data;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const row = { id: _uuid(), user_id: userId, ...record, created_at: new Date().toISOString() };
  const list = _lsList('practice');
  list.unshift(row);
  _lsSet('practice', list);
  return row;
}

async function loadPracticeHistory(userId, limit = 20) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('practice_problems')
        .select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(limit);
      if (data) { setSyncStatus(false); return data; }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  return _lsList('practice').slice(0, limit);
}

/** Recent recurring mistake patterns for the proactive warning banner. */
async function getMistakePatterns(userId, days = 7) {
  const history = await loadPracticeHistory(userId, 200);
  const cutoff = Date.now() - days * 86400000;
  const counts = {};
  history
    .filter(p => new Date(p.created_at).getTime() >= cutoff && p.error_type)
    .forEach(p => { counts[p.error_type] = (counts[p.error_type] || 0) + 1; });
  return Object.entries(counts)
    .map(([error_type, count]) => ({ error_type, count }))
    .sort((a, b) => b.count - a.count);
}

// ── FLASHCARDS (Phase 3.3) ───────────────────────────────────────────────────

async function saveFlashcardSet(userId, title, domain, cards) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('flashcard_sets')
        .insert({ user_id: userId, title, domain, cards }).select().single();
      setSyncStatus(false);
      return data;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const row = { id: _uuid(), user_id: userId, title, domain, cards, created_at: new Date().toISOString() };
  const list = _lsList('flashcards');
  list.unshift(row);
  _lsSet('flashcards', list);
  return row;
}

async function loadFlashcardSets(userId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('flashcard_sets')
        .select('*').eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (data) { setSyncStatus(false); return data; }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  return _lsList('flashcards');
}

async function deleteFlashcardSet(userId, setId) {
  const sb = getSB();
  if (sb) {
    try {
      await sb.from('flashcard_sets').delete().eq('id', setId).eq('user_id', userId);
      setSyncStatus(false);
      return;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  _lsSet('flashcards', _lsList('flashcards').filter(f => f.id !== setId));
}

// ── STUDY ROOMS (Phase 5.1) ──────────────────────────────────────────────────

function _roomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code + '-' + Math.floor(1000 + Math.random() * 9000);
}

// ── STUDY ROOMS (Phase 5.1) ──────────────────────────────────────────────────

function _roomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

async function createRoom(userId, name) {
  const room_code = _roomCode();
  const sb = getSB();
  if (sb) {
    try {
      const { data, error } = await sb.from('study_rooms')
        .insert({ created_by: userId, name, room_code }).select().single();
      if (!error && data) {
        await sb.from('room_members').insert({ room_id: data.id, user_id: userId }).catch(() => {});
        setSyncStatus(false);
        return data;
      }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  // Local fallback
  const room = { id: _uuid(), created_by: userId, name: name || 'Study Room', code: room_code, room_code, created_at: new Date().toISOString() };
  const list = _lsList('rooms');
  list.unshift(room);
  _lsSet('rooms', list);
  return room;
}

async function joinRoom(userId, roomCode, displayName) {
  const code = (roomCode || '').trim().toUpperCase();
  const sb = getSB();
  if (sb) {
    try {
      const { data: room, error } = await sb.from('study_rooms')
        .select('*').eq('room_code', code).single();
      if (!error && room) {
        await sb.from('room_members')
          .upsert({ room_id: room.id, user_id: userId, display_name: displayName }, { onConflict: 'room_id,user_id' }).catch(()=>{});
        setSyncStatus(false);
        return room;
      }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const list = _lsList('rooms');
  const found = list.find(r => (r.code || r.room_code || '').toUpperCase() === code);
  if (found) return found;
  // If joining by any code offline, create temporary room
  const localRoom = { id: _uuid(), created_by: userId, name: 'Room ' + code, code, room_code: code, created_at: new Date().toISOString() };
  list.unshift(localRoom);
  _lsSet('rooms', list);
  return localRoom;
}

async function joinRoomByCode(code) {
  return joinRoom('local_user', code, 'Peer');
}

// ── CURRICULUM PLANNER / DEADLINES (Phase 5.2) ───────────────────────────────

async function loadDeadlines(userId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('deadlines')
        .select('*').eq('user_id', userId)
        .order('due_date', { ascending: true });
      if (data) { setSyncStatus(false); return data; }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  return _lsList('deadlines');
}

async function addDeadline(userId, titleOrRecord, dueDate, domain) {
  let record = {};
  if (typeof titleOrRecord === 'object' && titleOrRecord !== null) {
    record = titleOrRecord;
  } else {
    record = { title: titleOrRecord, due_date: dueDate, domain: domain || 'math' };
  }
  if (!record.due_date && dueDate) record.due_date = dueDate;

  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('deadlines')
        .insert({ user_id: userId, ...record }).select().single();
      if (data) { setSyncStatus(false); return data; }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const row = { id: _uuid(), user_id: userId, ...record, completed: false, created_at: new Date().toISOString() };
  const list = _lsList('deadlines');
  list.push(row);
  _lsSet('deadlines', list);
  return row;
}

async function updateDeadline(userId, deadlineId, patch) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('deadlines')
        .update(patch).eq('id', deadlineId).eq('user_id', userId).select().single();
      setSyncStatus(false);
      return data;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const list = _lsList('deadlines');
  const idx = list.findIndex(d => d.id === deadlineId);
  if (idx !== -1) Object.assign(list[idx], patch);
  _lsSet('deadlines', list);
  return list[idx];
}

async function deleteDeadline(userId, deadlineId) {
  const sb = getSB();
  if (sb) {
    try {
      await sb.from('deadlines').delete().eq('id', deadlineId).eq('user_id', userId);
      setSyncStatus(false);
      return;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  _lsSet('deadlines', _lsList('deadlines').filter(d => d.id !== deadlineId));
}
