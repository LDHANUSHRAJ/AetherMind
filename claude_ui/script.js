/* ============================================================
   AetherMind — Script (Gradio 5.x compatible)
   ============================================================ */

const state = {
    conversations: JSON.parse(localStorage.getItem('am_convs') || '[]'),
    activeId: null,
    gradioUrl: localStorage.getItem('am_url') || '',
    generating: false,
};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// DOM
const sidebar = $('#sidebar');
const newChatBtn = $('#newChatBtn');
const searchToggle = $('#searchToggle');
const chatsToggle = $('#chatsToggle');
const sidebarSearch = $('#sidebarSearch');
const searchInput = $('#searchInput');
const sidebarConversations = $('#sidebarConversations');
const starredList = $('#starredList');
const recentsList = $('#recentsList');
const welcomeScreen = $('#welcomeScreen');
const welcomeHeading = $('#welcomeHeading');
const messagesArea = $('#messagesArea');
const messagesScroll = $('#messagesScroll');
const msgInput = $('#msgInput');
const sendBtn = $('#sendBtn');
const suggestionRow = $('#suggestionRow');
const settingsBtn = $('#settingsBtn');
const settingsModal = $('#settingsModal');
const closeModal = $('#closeModal');
const gradioUrlInput = $('#gradioUrl');
const connectBtn = $('#connectBtn');
const modalStatus = $('#modalStatus');
const connDot = $('#connDot');
const menuToggle = $('#menuToggle');
const exportModal = $('#exportModal');
const exportPdfBtn = $('#exportPdfBtn');
const exportPdfBtn2 = $('#exportPdfBtn2');
const exportDocBtn = $('#exportDocBtn');
const closeExportModal = $('#closeExportModal');

// ===== INIT =====
function init() {
    setGreeting();
    setupMarkdown();
    loadUrl();
    renderSidebar();
    bind();
    autoGrow(msgInput);
    if (state.conversations.length > 0) loadConv(state.conversations[0].id);
}

function setGreeting() {
    const h = new Date().getHours();
    let g = 'Good morning';
    if (h >= 12 && h < 17) g = 'Good afternoon';
    else if (h >= 17) g = 'Good evening';
    welcomeHeading.textContent = `${g}, Dhanush`;
}

function setupMarkdown() {
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            highlight: (code, lang) => {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang))
                    return hljs.highlight(code, { language: lang }).value;
                return code;
            },
            breaks: true, gfm: true,
        });
    }
}

// ===== EVENTS =====
function bind() {
    newChatBtn.addEventListener('click', newChat);
    sendBtn.addEventListener('click', send);
    msgInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    msgInput.addEventListener('input', () => { sendBtn.disabled = !msgInput.value.trim(); autoGrow(msgInput); });

    searchToggle.addEventListener('click', () => {
        const v = sidebarSearch.style.display === 'none';
        sidebarSearch.style.display = v ? 'block' : 'none';
        if (v) searchInput.focus();
    });
    searchInput.addEventListener('input', () => renderSidebar(searchInput.value.trim().toLowerCase()));

    chatsToggle.addEventListener('click', () => {
        sidebarConversations.style.display = sidebarConversations.style.display === 'none' ? 'block' : 'block';
    });

    settingsBtn.addEventListener('click', () => settingsModal.classList.add('visible'));
    closeModal.addEventListener('click', () => settingsModal.classList.remove('visible'));
    settingsModal.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.classList.remove('visible'); });
    connectBtn.addEventListener('click', doConnect);

    menuToggle?.addEventListener('click', () => sidebar.classList.toggle('open'));
    $('#sidebarCollapseBtn')?.addEventListener('click', () => sidebar.classList.remove('open'));

    // Export
    exportPdfBtn2?.addEventListener('click', () => exportModal.classList.add('visible'));
    closeExportModal?.addEventListener('click', () => exportModal.classList.remove('visible'));
    exportModal?.addEventListener('click', e => { if (e.target === exportModal) exportModal.classList.remove('visible'); });
    exportPdfBtn?.addEventListener('click', () => { toPdf(); exportModal.classList.remove('visible'); });
    exportDocBtn?.addEventListener('click', () => { toDoc(); exportModal.classList.remove('visible'); });

    $$('.suggestion').forEach(s => s.addEventListener('click', () => {
        msgInput.value = s.dataset.prompt;
        sendBtn.disabled = false;
        autoGrow(msgInput);
        send();
    }));
}

// ===== CONVERSATIONS =====
function newChat() {
    const c = { id: Date.now().toString(), title: 'New Conversation', messages: [], createdAt: new Date().toISOString() };
    state.conversations.unshift(c);
    state.activeId = c.id;
    save(); renderSidebar(); renderMsgs();
    msgInput.focus();
    sidebar.classList.remove('open');
}

function loadConv(id) {
    state.activeId = id;
    renderSidebar(); renderMsgs();
    sidebar.classList.remove('open');
}

function delConv(id, e) {
    e.stopPropagation();
    state.conversations = state.conversations.filter(c => c.id !== id);
    if (state.activeId === id) {
        state.activeId = state.conversations.length ? state.conversations[0].id : null;
    }
    save(); renderSidebar(); renderMsgs();
}

function active() { return state.conversations.find(c => c.id === state.activeId); }
function save() { localStorage.setItem('am_convs', JSON.stringify(state.conversations)); }

// ===== RENDER =====
function renderSidebar(filter = '') {
    let convs = state.conversations;
    if (filter) convs = convs.filter(c => c.title.toLowerCase().includes(filter));

    // Split starred (first 3) and recents
    const starred = convs.slice(0, 3);
    const recents = convs.slice(3);

    starredList.innerHTML = starred.length ? starred.map(c => convHtml(c)).join('') : '<div class="conv-empty">No starred chats</div>';
    recentsList.innerHTML = recents.length ? recents.map(c => convHtml(c)).join('') : (starred.length ? '' : '<div class="conv-empty">No conversations yet</div>');
}

function convHtml(c) {
    return `<div class="conv-item ${c.id === state.activeId ? 'active' : ''}" onclick="loadConv('${c.id}')">
        ${esc(c.title)}
        <button class="del-btn" onclick="delConv('${c.id}',event)" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
    </div>`;
}

function renderMsgs() {
    const c = active();
    if (!c || !c.messages.length) {
        welcomeScreen.style.display = 'flex';
        messagesArea.innerHTML = '';
        suggestionRow.style.display = 'flex';
        return;
    }
    welcomeScreen.style.display = 'none';
    suggestionRow.style.display = 'none';
    messagesArea.innerHTML = '';
    c.messages.forEach(m => addMsg(m.role, m.content, false));
    scrollEnd();
}

function addMsg(role, content, anim = true) {
    welcomeScreen.style.display = 'none';
    suggestionRow.style.display = 'none';

    const d = document.createElement('div');
    d.className = `msg ${role}`;
    if (!anim) d.style.animation = 'none';

    const avatar = role === 'user' ? 'D' : '✺';
    const name = role === 'user' ? 'You' : 'AetherMind';
    let body = content;
    if (typeof marked !== 'undefined' && role === 'assistant') {
        try { body = marked.parse(content); } catch { body = content.replace(/\n/g, '<br>'); }
    } else {
        body = esc(content).replace(/\n/g, '<br>');
    }

    d.innerHTML = `<div class="msg-inner">
        <div class="msg-avatar">${avatar}</div>
        <div class="msg-content">
            <div class="msg-sender">${name}</div>
            <div class="msg-body">${body}</div>
        </div>
    </div>`;

    messagesArea.appendChild(d);
    if (typeof hljs !== 'undefined') d.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
    scrollEnd();
    return d;
}

function showTyping() {
    const d = document.createElement('div');
    d.className = 'msg assistant'; d.id = 'typingEl';
    d.innerHTML = `<div class="msg-inner">
        <div class="msg-avatar">✺</div>
        <div class="msg-content">
            <div class="msg-sender">AetherMind</div>
            <div class="msg-body"><div class="typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>
        </div>
    </div>`;
    messagesArea.appendChild(d);
    scrollEnd();
}

function hideTyping() { document.getElementById('typingEl')?.remove(); }

// ===== SEND =====
async function send() {
    const text = msgInput.value.trim();
    if (!text || state.generating) return;
    if (!state.activeId) newChat();
    const c = active();
    if (!c) return;

    c.messages.push({ role: 'user', content: text });
    if (c.messages.length === 1) { c.title = text.substring(0, 45) + (text.length > 45 ? '...' : ''); renderSidebar(); }
    save();
    addMsg('user', text);

    msgInput.value = ''; sendBtn.disabled = true; autoGrow(msgInput);
    state.generating = true;
    showTyping();

    try {
        const res = await callAPI(text);
        hideTyping();
        c.messages.push({ role: 'assistant', content: res });
        save(); addMsg('assistant', res);
    } catch (err) {
        hideTyping();
        const e = `Could not reach AetherMind.\n\n${err.message}`;
        c.messages.push({ role: 'assistant', content: e });
        save(); addMsg('assistant', e);
    }
    state.generating = false;
}

// ===== GRADIO API (v5.x + v4.x + fallbacks) =====
function loadUrl() {
    if (state.gradioUrl) {
        gradioUrlInput.value = state.gradioUrl;
        connDot.classList.add('connected');
        connDot.title = 'Connected';
    }
}

async function doConnect() {
    const url = gradioUrlInput.value.trim().replace(/\/$/, '');
    if (!url) return;
    state.gradioUrl = url;
    localStorage.setItem('am_url', url);
    connDot.classList.remove('connected'); connDot.classList.add('connecting');
    modalStatus.textContent = 'Testing connection...';

    try {
        // Quick test
        await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(5000) });
        connDot.classList.remove('connecting'); connDot.classList.add('connected');
        connDot.title = 'Connected';
        modalStatus.textContent = '✓ Connected successfully!';
        modalStatus.style.color = '#16a34a';
        setTimeout(() => settingsModal.classList.remove('visible'), 800);
    } catch {
        connDot.classList.remove('connecting'); connDot.classList.add('connected');
        connDot.title = 'Connected';
        modalStatus.textContent = '✓ URL saved. Will connect on first message.';
        modalStatus.style.color = '#16a34a';
        setTimeout(() => settingsModal.classList.remove('visible'), 800);
    }
}

async function callAPI(message) {
    const url = state.gradioUrl;
    if (!url) throw new Error('No Gradio URL set. Click Settings in the sidebar to configure it.');

    // Gradio 5.x uses /gradio_api/ prefix with SSE v3 protocol
    const prefixes = ['/gradio_api', ''];
    const names = ['predict', 'chat'];

    for (const prefix of prefixes) {
        for (const name of names) {
            try {
                const r = await fetch(`${url}${prefix}/call/${name}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: [message] }),
                    signal: AbortSignal.timeout(15000),
                });
                if (r.ok) {
                    const j = await r.json();
                    if (j.event_id) {
                        const sr = await fetch(`${url}${prefix}/call/${name}/${j.event_id}`, { signal: AbortSignal.timeout(120000) });
                        if (sr.ok) {
                            const txt = await sr.text();
                            const result = parseSSE(txt);
                            if (result) return result;
                        }
                    }
                }
            } catch (e) { console.log(`${prefix}/call/${name} failed:`, e.message); }
        }
    }

    throw new Error('Could not connect. Ensure your Colab is running and the Gradio link is active.');
}

function parseSSE(text) {
    const lines = text.split('\n');
    let last = '';
    for (const line of lines) {
        const l = line.trim();
        if (l.startsWith('data:')) {
            const d = l.substring(5).trim();
            try {
                const p = JSON.parse(d);
                if (Array.isArray(p) && p[0]) last = p[0];
            } catch {
                if (d && d !== '[null]') last = d;
            }
        }
    }
    return last;
}

// ===== EXPORT =====
function toPdf() {
    const c = active();
    if (!c?.messages.length) return alert('No messages to export!');
    const div = document.createElement('div');
    div.style.cssText = 'padding:24px;font-family:Inter,Arial,sans-serif;color:#1a1714;max-width:700px;';
    div.innerHTML = `<div style="text-align:center;margin-bottom:20px"><h1 style="font-size:20px;color:#c96442">AetherMind</h1><p style="color:#999;font-size:10px">AI Startup Mentor</p><hr style="border:1px solid #e5e2dd;margin-top:10px"></div>` +
        c.messages.map(m => `<div style="margin-bottom:12px"><p style="font-size:11px;font-weight:600;color:${m.role==='user'?'#6366f1':'#c96442'};margin-bottom:2px">${m.role==='user'?'You':'AetherMind'}</p><div style="font-size:12px;line-height:1.7;color:#333;padding-left:8px;border-left:3px solid ${m.role==='user'?'#6366f1':'#c96442'}">${typeof marked!=='undefined'?marked.parse(m.content):m.content.replace(/\n/g,'<br>')}</div></div>`).join('') +
        `<div style="text-align:center;margin-top:16px;border-top:1px solid #e5e2dd;padding-top:8px"><p style="font-size:9px;color:#aaa">AetherMind — ${new Date().toLocaleString()}</p></div>`;
    html2pdf().set({ margin: 0.5, filename: `AetherMind_${c.title.replace(/[^a-z0-9]/gi,'_').substring(0,25)}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4' } }).from(div).save();
}

function toDoc() {
    const c = active();
    if (!c?.messages.length) return alert('No messages to export!');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body{font-family:Calibri,sans-serif;padding:24px;color:#222;line-height:1.7}h1{color:#c96442;font-size:20px;text-align:center}.s{font-weight:bold;font-size:11px}.u{color:#6366f1}.a{color:#c96442}.c{font-size:12px;padding-left:10px;border-left:3px solid #ddd}</style></head><body><h1>AetherMind</h1><hr>` +
        c.messages.map(m => `<p class="s ${m.role==='user'?'u':'a'}">${m.role==='user'?'You':'AetherMind'}</p><div class="c">${typeof marked!=='undefined'?marked.parse(m.content):m.content.replace(/\n/g,'<br>')}</div><br>`).join('') +
        `<hr><p style="text-align:center;color:#aaa;font-size:9px">AetherMind — ${new Date().toLocaleString()}</p></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AetherMind_${c.title.replace(/[^a-z0-9]/gi,'_').substring(0,25)}.doc`;
    a.click();
}

// ===== UTILS =====
function scrollEnd() { requestAnimationFrame(() => { messagesScroll.scrollTop = messagesScroll.scrollHeight; }); }
function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 150) + 'px'; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

window.loadConv = loadConv;
window.delConv = delConv;

document.addEventListener('DOMContentLoaded', init);
