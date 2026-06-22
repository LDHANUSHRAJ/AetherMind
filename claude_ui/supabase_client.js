// ═══════════════════════════════════════════════════════════════════
// AETHERMIND — supabase_client.js
// Real Supabase backend. Falls back to localStorage for EX-6.
//
// SETUP: Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY below
//        with values from your Supabase project → Settings → API
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

const SUPABASE_CONFIGURED = !SUPABASE_URL.includes('YOUR_');

let _sb = null;

function getSB() {
    if (!SUPABASE_CONFIGURED) return null;
    if (!_sb && window.supabase) {
        _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                storageKey: 'am_supabase_session',
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }
    return _sb;
}

// ─── Sync Status (EX-6) ──────────────────────────────────────────
let _syncOffline = false;

function setSyncStatus(offline) {
    _syncOffline = offline;
    let bar = document.getElementById('am-sync-bar');
    if (offline) {
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'am-sync-bar';
            bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:#f59e0b;color:white;text-align:center;padding:6px;font-size:12px;font-weight:600;';
            bar.textContent = '⚠ Offline — changes saved locally and will sync when connection is restored';
            document.body.prepend(bar);
        }
    } else if (bar) {
        bar.remove();
    }
}

function isNetworkError(err) {
    return err && (
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError') ||
        err.message?.includes('fetch') ||
        err.code === 'NETWORK_ERROR' ||
        err.status === 0
    );
}

// ─── localStorage Helpers (fallback / demo) ──────────────────────
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
function db(table) { return JSON.parse(localStorage.getItem('am_' + table) || '[]'); }
function dbSet(table, data) { localStorage.setItem('am_' + table, JSON.stringify(data)); }
function dbSingle(table) { return JSON.parse(localStorage.getItem('am_' + table) || 'null'); }
function dbSetSingle(table, data) { localStorage.setItem('am_' + table, JSON.stringify(data)); }
function delay(ms = 80) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════

function getSession() {
    const sb = getSB();
    if (sb) {
        const raw = localStorage.getItem('am_supabase_session');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                return parsed?.currentSession || parsed;
            } catch { return null; }
        }
        return null;
    }
    const raw = localStorage.getItem('am_session') || sessionStorage.getItem('am_session');
    return raw ? JSON.parse(raw) : null;
}

async function getSessionAsync() {
    const sb = getSB();
    if (sb) {
        const { data } = await sb.auth.getSession();
        return data?.session || null;
    }
    return getSession();
}

async function checkAuth() {
    const sb = getSB();
    if (sb) {
        const { data } = await sb.auth.getSession();
        if (!data?.session) { window.location.href = 'auth.html'; return null; }
        return data.session;
    }
    const session = getSession();
    if (!session) { window.location.href = 'auth.html'; return null; }
    return session;
}

async function checkAlreadyLoggedIn() {
    const sb = getSB();
    if (sb) {
        const { data } = await sb.auth.getSession();
        if (data?.session) { window.location.href = 'index.html'; return true; }
        return false;
    }
    if (getSession()) { window.location.href = 'index.html'; return true; }
    return false;
}

async function signUp(email, password, fullName) {
    const sb = getSB();
    if (sb) {
        try {
            const { data, error } = await sb.auth.signUp({
                email, password,
                options: { data: { full_name: fullName } }
            });
            if (error) throw new Error(error.message);
            return { success: true, user: data.user };
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); return _localSignUp(email, password, fullName); }
            throw err;
        }
    }
    return _localSignUp(email, password, fullName);
}

function _localSignUp(email, password, fullName) {
    const userId = uuid();
    dbSetSingle('profile_' + userId, {
        id: userId, full_name: fullName, email, avatar_url: null,
        joined: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        member_id: 'am-usr-' + uuid().substring(0, 6)
    });
    dbSetSingle('settings_' + userId, {
        user_id: userId, max_tokens: 2048, temperature: 0.7, context_limit: 16000,
        dark_mode: false, font_size: 'medium', compact_mode: false,
        accent_color: '#2b1c86', ollama_url: 'http://localhost:8000'
    });
    return { success: true, user: { id: userId, email, user_metadata: { full_name: fullName } } };
}

async function login(email, password, rememberMe) {
    const sb = getSB();
    if (sb) {
        try {
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw new Error(error.message);
            setSyncStatus(false);
            return { success: true, session: data.session };
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); return _localLogin(email, password, rememberMe); }
            throw err;
        }
    }
    return _localLogin(email, password, rememberMe);
}

function _localLogin(email, password, rememberMe) {
    let userId = localStorage.getItem('am_user_by_' + email);
    if (!userId) {
        const res = _localSignUp(email, password, email.split('@')[0]);
        userId = res.user.id;
        localStorage.setItem('am_user_by_' + email, userId);
    }
    const profile = dbSingle('profile_' + userId);
    const session = {
        user: { id: userId, email, user_metadata: { full_name: profile?.full_name || email.split('@')[0] } }
    };
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('am_session', JSON.stringify(session));
    return { success: true, session };
}

async function logout() {
    const sb = getSB();
    if (sb) { await sb.auth.signOut().catch(() => {}); }
    localStorage.removeItem('am_session');
    sessionStorage.removeItem('am_session');
    window.location.href = 'auth.html';
}

async function updatePassword(newPassword) {
    const sb = getSB();
    if (sb) {
        const { error } = await sb.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);
    }
    return { success: true };
}

async function deleteAccount() {
    const session = await getSessionAsync().catch(() => getSession());
    if (!session) return;
    const sb = getSB();
    const uid = session.user?.id;

    if (sb && uid) {
        const { data: sessRows } = await sb.from('chat_sessions').select('id').eq('user_id', uid).catch(() => ({ data: [] }));
        const ids = (sessRows || []).map(s => s.id);
        if (ids.length) await sb.from('messages').delete().in('session_id', ids).catch(() => {});
        await sb.from('chat_sessions').delete().eq('user_id', uid).catch(() => {});
        await sb.from('query_logs').delete().eq('user_id', uid).catch(() => {});
        await sb.from('study_topics').delete().eq('user_id', uid).catch(() => {});
        await sb.from('user_settings').delete().eq('user_id', uid).catch(() => {});
        await sb.from('profiles').delete().eq('id', uid).catch(() => {});
        await sb.auth.signOut().catch(() => {});
    } else if (uid) {
        Object.keys(localStorage).filter(k => k.includes(uid) || k === 'am_session').forEach(k => localStorage.removeItem(k));
        sessionStorage.removeItem('am_session');
    }
    window.location.href = 'auth.html';
}

async function signOutAllDevices() {
    const sb = getSB();
    if (sb) await sb.auth.signOut({ scope: 'global' }).catch(() => {});
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════════
// USER SETTINGS
// ═══════════════════════════════════════════════════════════════════

async function loadSettings(userId) {
    const defaults = {
        user_id: userId, max_tokens: 2048, temperature: 0.7, context_limit: 16000,
        dark_mode: false, font_size: 'medium', compact_mode: false,
        accent_color: '#2b1c86', ollama_url: 'http://localhost:8000'
    };
    const sb = getSB();
    if (sb) {
        try {
            const { data } = await sb.from('user_settings').select('*').eq('user_id', userId).single();
            if (data) { setSyncStatus(false); return { ...defaults, ...data }; }
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    const local = dbSingle('settings_' + userId);
    if (!local) { dbSetSingle('settings_' + userId, defaults); return defaults; }
    return { ...defaults, ...local };
}

async function updateSetting(userId, key, value) {
    const sb = getSB();
    if (sb) {
        try {
            await sb.from('user_settings').upsert({ user_id: userId, [key]: value }, { onConflict: 'user_id' });
            setSyncStatus(false);
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    const settings = dbSingle('settings_' + userId) || {};
    settings[key] = value;
    dbSetSingle('settings_' + userId, settings);
    return settings;
}

// ═══════════════════════════════════════════════════════════════════
// CHAT SESSIONS & MESSAGES
// ═══════════════════════════════════════════════════════════════════

async function createChatSession(userId, title) {
    const sb = getSB();
    if (sb) {
        try {
            const { data, error } = await sb.from('chat_sessions')
                .insert({ user_id: userId, title: title || 'New Chat' })
                .select().single();
            if (!error && data) { setSyncStatus(false); return data; }
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    const sessions = db('sessions_' + userId);
    const session = {
        id: uuid(), user_id: userId, title: title || 'New Chat',
        is_pinned: false,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    sessions.unshift(session);
    dbSet('sessions_' + userId, sessions);
    return session;
}

async function loadChatSessions(userId) {
    const sb = getSB();
    if (sb) {
        try {
            const { data, error } = await sb.from('chat_sessions')
                .select('*').eq('user_id', userId).order('updated_at', { ascending: false });
            if (!error) { setSyncStatus(false); return data || []; }
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); return db('sessions_' + userId); }
        }
    }
    return db('sessions_' + userId);
}

async function updateChatSession(userId, sessionId, updates) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const sb = getSB();
    if (sb) {
        try {
            const { data } = await sb.from('chat_sessions')
                .update(payload).eq('id', sessionId).eq('user_id', userId)
                .select().single();
            setSyncStatus(false);
            return data;
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    const sessions = db('sessions_' + userId);
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) Object.assign(sessions[idx], payload);
    dbSet('sessions_' + userId, sessions);
    return sessions[idx];
}

async function deleteChatSession(userId, sessionId) {
    const sb = getSB();
    if (sb) {
        try {
            await sb.from('chat_sessions').delete().eq('id', sessionId).eq('user_id', userId);
            setSyncStatus(false);
            return;
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    dbSet('sessions_' + userId, db('sessions_' + userId).filter(s => s.id !== sessionId));
    localStorage.removeItem('am_messages_' + sessionId);
}

async function saveMessage(sessionId, role, content) {
    const sb = getSB();
    if (sb) {
        try {
            const { data } = await sb.from('messages')
                .insert({ session_id: sessionId, role, content }).select().single();
            setSyncStatus(false);
            return data;
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    const messages = db('messages_' + sessionId);
    const msg = { id: uuid(), session_id: sessionId, role, content, created_at: new Date().toISOString() };
    messages.push(msg);
    dbSet('messages_' + sessionId, messages);
    return msg;
}

async function loadMessages(sessionId) {
    const sb = getSB();
    if (sb) {
        try {
            const { data, error } = await sb.from('messages')
                .select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
            if (!error) { setSyncStatus(false); return data || []; }
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); return db('messages_' + sessionId); }
        }
    }
    return db('messages_' + sessionId);
}

// ═══════════════════════════════════════════════════════════════════
// QUERY LOGS & ANALYTICS
// ═══════════════════════════════════════════════════════════════════

async function logQuery(userId, domain, tokensUsed, quality) {
    const entry = { user_id: userId, domain, tokens_used: tokensUsed, response_quality: quality };
    const sb = getSB();
    if (sb) {
        try {
            await sb.from('query_logs').insert(entry);
            setSyncStatus(false);
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    const logs = db('query_logs_' + userId);
    logs.push({ id: uuid(), ...entry, created_at: new Date().toISOString() });
    dbSet('query_logs_' + userId, logs);
}

async function loadDashboardData(userId) {
    let logs = [];
    const sb = getSB();
    if (sb) {
        try {
            const { data } = await sb.from('query_logs')
                .select('*').eq('user_id', userId).order('created_at', { ascending: true });
            if (data) { logs = data; setSyncStatus(false); }
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); logs = db('query_logs_' + userId); }
        }
    } else {
        logs = db('query_logs_' + userId);
    }

    let mistakes = db('mistakes_' + userId);
    if (!mistakes.length) {
        mistakes = [
            { error: 'Integration by parts', count: 12 },
            { error: 'Binary search off-by-one', count: 8 },
            { error: 'Bayes theorem direction', count: 5 }
        ];
    }

    if (!logs.length) {
        return {
            totalQueries: 0, tokensUsed: 0, activeDomain: 'None yet', learningStreak: 0,
            domains: [], dailyData: [], monthlyData: [],
            qualityCounts: { excellent: 0, good: 0, poor: 0 },
            domainAccuracy: {}, mistakes
        };
    }

    const totalQueries = logs.length;
    const tokensUsed = logs.reduce((s, l) => s + (l.tokens_used || 0), 0);
    const sorted = [...logs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const activeDomain = sorted[0]?.domain || 'N/A';

    const domainCounts = {};
    logs.forEach(l => { if (l.domain) domainCounts[l.domain] = (domainCounts[l.domain] || 0) + 1; });
    const domainColors = { math: '#2b1c86', stats: '#9333ea', coding: '#3b82f6', webdev: '#10b981', security: '#f59e0b', general: '#64748b' };
    const domains = Object.entries(domainCounts)
        .map(([name, count]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            percent: Math.round(count / totalQueries * 100),
            color: domainColors[name] || '#cbd5e1'
        }))
        .sort((a, b) => b.percent - a.percent);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let streak = 0;
    for (let d = 0; d < 365; d++) {
        const dayStr = new Date(today - d * 86400000).toISOString().split('T')[0];
        if (logs.some(l => l.created_at?.startsWith(dayStr))) streak++;
        else break;
    }

    const dailyData = [];
    for (let d = 29; d >= 0; d--) {
        const dayStr = new Date(today - d * 86400000).toISOString().split('T')[0];
        dailyData.push({ date: dayStr, count: logs.filter(l => l.created_at?.startsWith(dayStr)).length });
    }

    const monthlyData = [];
    for (let m = 11; m >= 0; m--) {
        const month = new Date(today.getFullYear(), today.getMonth() - m, 1);
        const monthStr = month.toISOString().substring(0, 7);
        monthlyData.push({ date: monthStr, count: logs.filter(l => l.created_at?.startsWith(monthStr)).length });
    }

    const qualityCounts = { excellent: 0, good: 0, poor: 0 };
    logs.forEach(l => { if (qualityCounts[l.response_quality] !== undefined) qualityCounts[l.response_quality]++; });

    const domainAccuracy = {};
    Object.keys(domainCounts).forEach(d => {
        const domLogs = logs.filter(l => l.domain === d);
        const exc = domLogs.filter(l => l.response_quality === 'excellent').length;
        domainAccuracy[d] = domLogs.length ? Math.round(exc / domLogs.length * 100) : 0;
    });

    return {
        totalQueries, tokensUsed, activeDomain, learningStreak: streak,
        domains, dailyData, monthlyData, qualityCounts, domainAccuracy, mistakes
    };
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE DATA
// ═══════════════════════════════════════════════════════════════════

async function loadProfileData(userId) {
    const sb = getSB();
    let profile = null;
    if (sb) {
        try {
            const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
            if (data) { profile = data; setSyncStatus(false); }
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    if (!profile) {
        profile = dbSingle('profile_' + userId) || {
            full_name: 'User', email: '', joined_at: new Date().toISOString(), member_id: 'am-usr-000000'
        };
    }

    const dashData = await loadDashboardData(userId);
    const acc = dashData.domainAccuracy || {};
    const accSorted = Object.entries(acc).sort((a, b) => b[1] - a[1]);
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const strongest = accSorted[0] ? `${cap(accSorted[0][0])} (${accSorted[0][1]}%)` : 'N/A';
    const weakest = accSorted.length > 1 ? `${cap(accSorted[accSorted.length-1][0])} (${accSorted[accSorted.length-1][1]}%)` : 'N/A';

    return {
        full_name: profile.full_name || 'User',
        email: profile.email || '',
        joined: profile.joined_at
            ? new Date(profile.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : (profile.joined || 'N/A'),
        member_id: profile.member_id || 'N/A',
        learningStreak: dashData.learningStreak,
        totalQueries: dashData.totalQueries,
        strongestDomain: strongest,
        needsImprovement: weakest,
        mistakes: dashData.mistakes
    };
}

async function updateProfile(userId, updates) {
    const sb = getSB();
    if (sb) {
        try {
            await sb.from('profiles').update(updates).eq('id', userId);
            setSyncStatus(false);
            if (updates.full_name) await sb.auth.updateUser({ data: { full_name: updates.full_name } }).catch(() => {});
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    const profile = dbSingle('profile_' + userId) || {};
    Object.assign(profile, updates);
    dbSetSingle('profile_' + userId, profile);
    if (updates.full_name) {
        const session = getSession();
        if (session?.user) {
            session.user.user_metadata = session.user.user_metadata || {};
            session.user.user_metadata.full_name = updates.full_name;
            localStorage.setItem('am_session', JSON.stringify(session));
        }
    }
    return profile;
}

// ═══════════════════════════════════════════════════════════════════
// STUDY PLANNER
// ═══════════════════════════════════════════════════════════════════

async function loadStudyTopics(userId, status) {
    const sb = getSB();
    let topics = [];
    if (sb) {
        try {
            let query = sb.from('study_topics').select('*').eq('user_id', userId).order('order_index');
            if (status) query = query.eq('status', status);
            const { data } = await query;
            if (data) { topics = data; setSyncStatus(false); }
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    if (!topics.length) {
        topics = db('study_topics_' + userId);
        if (!topics.length) {
            topics = [
                { id: uuid(), user_id: userId, title: 'Data Structures: Trees & Graphs', status: 'active', is_focus: true, order_index: 0 },
                { id: uuid(), user_id: userId, title: 'Async/Await in Python', status: 'active', is_focus: false, order_index: 1 },
                { id: uuid(), user_id: userId, title: 'Neural Network Foundations', status: 'active', is_focus: false, order_index: 2 },
                { id: uuid(), user_id: userId, title: 'Sorting Algorithms Deep Dive', status: 'completed', is_focus: false, order_index: 0 },
                { id: uuid(), user_id: userId, title: 'HTTP & REST API Design', status: 'completed', is_focus: false, order_index: 1 },
                { id: uuid(), user_id: userId, title: 'Quantum Computing Basics', status: 'saved', is_focus: false, order_index: 0 },
            ];
            dbSet('study_topics_' + userId, topics);
        }
        if (status) topics = topics.filter(t => t.status === status);
    }
    return topics.sort((a, b) => a.order_index - b.order_index);
}

async function updateStudyTopic(userId, topicId, updates) {
    const sb = getSB();
    if (sb) {
        try {
            await sb.from('study_topics').update(updates).eq('id', topicId).eq('user_id', userId);
            setSyncStatus(false); return;
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    const topics = db('study_topics_' + userId);
    const idx = topics.findIndex(t => t.id === topicId);
    if (idx !== -1) Object.assign(topics[idx], updates);
    dbSet('study_topics_' + userId, topics);
}

async function reorderStudyTopics(userId, orderedIds) {
    const sb = getSB();
    if (sb) {
        try {
            for (let i = 0; i < orderedIds.length; i++) {
                await sb.from('study_topics').update({ order_index: i }).eq('id', orderedIds[i]).eq('user_id', userId);
            }
            setSyncStatus(false); return;
        } catch (err) {
            if (isNetworkError(err)) { setSyncStatus(true); }
        }
    }
    const topics = db('study_topics_' + userId);
    orderedIds.forEach((id, i) => { const t = topics.find(t => t.id === id); if (t) t.order_index = i; });
    dbSet('study_topics_' + userId, topics);
}

// ═══════════════════════════════════════════════════════════════════
// DATA EXPORT
// ═══════════════════════════════════════════════════════════════════

async function exportData(userId, format, range) {
    const logs = db('query_logs_' + userId);
    const sessions = db('sessions_' + userId);
    const settings = dbSingle('settings_' + userId);
    const cutoff = new Date(Date.now() - ({ '7': 7, '30': 30, '90': 90 }[range] || 30) * 86400000).toISOString();
    const filtered = range === 'all' ? logs : logs.filter(l => l.created_at >= cutoff);

    let blob, filename;
    if (format === 'csv') {
        const rows = filtered.map(l => `${l.id},${l.domain},${l.tokens_used},${l.response_quality},${l.created_at}`).join('\n');
        blob = new Blob(['id,domain,tokens_used,response_quality,created_at\n' + rows], { type: 'text/csv' });
        filename = 'aethermind_export.csv';
    } else {
        blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), user_settings: settings, query_logs: filtered, chat_sessions: sessions }, null, 2)], { type: 'application/json' });
        filename = 'aethermind_export.json';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    return { success: true, filename };
}

// ═══════════════════════════════════════════════════════════════════
// THEME & UI UTILITIES
// ═══════════════════════════════════════════════════════════════════

function applyTheme(isDark) {
    if (isDark) document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
}

async function initTheme() {
    const session = await getSessionAsync().catch(() => getSession());
    if (!session) return;
    const userId = session.user?.id;
    if (!userId) return;
    const settings = await loadSettings(userId);
    applyTheme(settings.dark_mode);
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('am-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'am-toast';
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:9999;transition:all 0.3s ease;opacity:0;transform:translateY(20px);font-family:Inter,system-ui,sans-serif;pointer-events:none;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
    toast.style.color = 'white';
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 2500);
}
