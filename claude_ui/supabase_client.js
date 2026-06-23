/**
 * supabase_client.js — AetherMind data layer
 *
 * Schema (4 tables, all linked to auth.users via user_id):
 *   profiles       — full_name, avatar_url
 *   user_settings  — temperature, token_limit, theme, daily_goal, focus_domains, ollama_url
 *   chat_sessions  — title, pinned, created_at, updated_at
 *   query_logs     — session_id, role, content, domain, tokens_used, is_verified
 *
 * Credentials are read from window.__AM_ENV (injected by env-loader.js at startup).
 * Falls back to localStorage for every operation when Supabase is unreachable (EX-6).
 */

// ── Credential bootstrap ─────────────────────────────────────────────────────
// env-loader.js reads .env at dev-server startup and sets window.__AM_ENV.
// In production, replace with your build tool's env injection.
const _env = (typeof window !== 'undefined' && window.__AM_ENV) || {};
const SUPABASE_URL     = _env.SUPABASE_URL     || '';
const SUPABASE_ANON_KEY = _env.SUPABASE_ANON_KEY || '';
const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('YOUR_') && !SUPABASE_ANON_KEY.includes('YOUR_'));

let _sb = null;
function getSB() {
  if (!CONFIGURED) return null;
  if (!_sb && window.supabase) {
    try {
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          storageKey: 'am_session',
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
    return data?.session || null;
  }
  return _lsGet('local_session');
}

/** Redirect to auth page if no valid session. Call at top of every protected page. */
async function requireAuth() {
  const session = await getSession();
  if (!session) { window.location.href = 'AetherMind Auth.dc.html'; return null; }
  return session;
}

/** Redirect away from auth page if already signed in. */
async function redirectIfAuthed() {
  const session = await getSession();
  if (session) { window.location.href = 'AetherMind Chat.dc.html'; return true; }
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
  const sb = getSB();
  if (sb) {
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      setSyncStatus(false);
      return { success: true, session: data.session };
    } catch (err) {
      if (!isNetErr(err)) throw err;
      setSyncStatus(true);
    }
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
  window.location.href = 'AetherMind Auth.dc.html';
}

async function updatePassword(newPassword) {
  const sb = getSB();
  if (!sb) throw new Error('Supabase not configured');
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/** Full cascade delete: query_logs → chat_sessions → user_settings → profiles → auth user */
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
    await sb.from('profiles').delete().eq('user_id', uid).catch(() => {});
    await sb.auth.admin?.deleteUser(uid).catch(() => {}); // requires service role in edge fn
    await sb.auth.signOut().catch(() => {});
  }
  ['local_session','local_profile','local_settings','local_sessions','local_logs']
    .forEach(k => localStorage.removeItem('am_' + k));
  window.location.href = 'AetherMind Auth.dc.html';
}

// ── PROFILES ─────────────────────────────────────────────────────────────────

async function loadProfile(userId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('profiles').select('*').eq('user_id', userId).single();
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
        .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
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

// ── CHAT SESSIONS ─────────────────────────────────────────────────────────────

async function loadSessions(userId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('chat_sessions')
        .select('*').eq('user_id', userId)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (data) { setSyncStatus(false); return data; }
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
      return data;
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
      const { data } = await sb.from('chat_sessions')
        .update(patch).eq('id', sessionId).eq('user_id', userId)
        .select().single();
      setSyncStatus(false);
      return data;
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
      // query_logs cascade-delete via FK; no separate delete needed
      await sb.from('chat_sessions').delete().eq('id', sessionId).eq('user_id', userId);
      setSyncStatus(false);
      return;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  _lsSet('local_sessions', _lsList('local_sessions').filter(s => s.id !== sessionId));
  // remove local logs for this session
  localStorage.removeItem('am_logs_' + sessionId);
}

// ── QUERY LOGS (chat messages + analytics) ────────────────────────────────────

async function loadMessages(sessionId) {
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('query_logs')
        .select('*').eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (data) { setSyncStatus(false); return data; }
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  return _lsList('logs_' + sessionId);
}

async function appendMessage(userId, sessionId, role, content, meta = {}) {
  // meta: { domain, tokens_used, is_verified }
  const row = { user_id: userId, session_id: sessionId, role, content,
                domain: meta.domain || null,
                tokens_used: meta.tokens_used || 0,
                is_verified: meta.is_verified || false };
  const sb = getSB();
  if (sb) {
    try {
      const { data } = await sb.from('query_logs').insert(row).select().single();
      setSyncStatus(false);
      // bump session updated_at
      await sb.from('chat_sessions').update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId).eq('user_id', userId).catch(() => {});
      return data;
    } catch (err) { if (isNetErr(err)) setSyncStatus(true); }
  }
  const entry = { id: _uuid(), ...row, created_at: new Date().toISOString() };
  const list = _lsList('logs_' + sessionId);
  list.push(entry);
  _lsSet('logs_' + sessionId, list);
  return entry;
}

// ── DASHBOARD ANALYTICS ───────────────────────────────────────────────────────

async function loadDashboard(userId) {
  const sb = getSB();
  let logs = [];
  if (sb) {
    try {
      const { data } = await sb.from('query_logs')
        .select('domain,tokens_used,is_verified,created_at')
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
  const verified = logs.filter(l => l.is_verified).length;
  const accuracy = total ? Math.round(verified / total * 100) : 0;

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
  const recentSessions = sessions.slice(0, 5).map(s => ({
    title: s.title,
    domain: domMap[Object.keys(domMap)[0]] ? Object.keys(domMap)[0] : '—',
    tokens: (logs.filter(l => l.session_id === s.id).reduce((a, l) => a + (l.tokens_used || 0), 0)).toLocaleString(),
    date: new Date(s.updated_at || s.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    tagBg: 'var(--violet-soft)', tagColor: 'var(--violet-2)',
  }));

  return { total, tokens, accuracy, streak, bars: barsWithPct, heatmap, domains, recentSessions };
}
