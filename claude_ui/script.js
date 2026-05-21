/* ============================================================
   AetherMind — Script (Gradio 5.x compatible)
   ============================================================ */

const state = {
    conversations: JSON.parse(localStorage.getItem('am_convs') || '[]'),
    activeId: null,
    gradioUrl: localStorage.getItem('am_url') || '',
    searchApiKey: localStorage.getItem('am_search_key') || '',
    supabaseUrl: localStorage.getItem('am_supabase_url') || '',
    supabaseKey: localStorage.getItem('am_supabase_key') || '',
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
const searchApiInput = $('#searchApiKey');
const supabaseUrlInput = $('#supabaseUrl');
const supabaseKeyInput = $('#supabaseKey');
const connectBtn = $('#connectBtn');
const modalStatus = $('#modalStatus');
const connDot = $('#connDot');
const menuToggle = $('#menuToggle');
const exportModal = $('#exportModal');
const exportPdfBtn = $('#exportPdfBtn');
const exportPdfBtn2 = $('#exportPdfBtn2');
const exportDocBtn = $('#exportDocBtn');
const shareCloudBtn = $('#shareCloudBtn');
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
        
        // Custom renderer for checkboxes
        const renderer = new marked.Renderer();
        const originalListitem = renderer.listitem.bind(renderer);
        renderer.listitem = function(text, task, checked) {
            if (task) {
                return `<li class="task-list-item" style="list-style-type: none; margin-left: -20px; margin-bottom: 8px;">
                    <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                        <input type="checkbox" style="margin-top: 4px;" ${checked ? 'checked' : ''}>
                        <span>${text.replace(/<input.*?>/, '')}</span>
                    </label>
                </li>`;
            }
            return originalListitem(text, task, checked);
        };
        marked.use({ renderer });
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

    // Export & Share
    exportPdfBtn2?.addEventListener('click', () => exportModal.classList.add('visible'));
    closeExportModal?.addEventListener('click', () => exportModal.classList.remove('visible'));
    exportModal?.addEventListener('click', e => { if (e.target === exportModal) exportModal.classList.remove('visible'); });
    exportPdfBtn?.addEventListener('click', () => { toPdf(); exportModal.classList.remove('visible'); });
    exportDocBtn?.addEventListener('click', () => { toDoc(); exportModal.classList.remove('visible'); });
    shareCloudBtn?.addEventListener('click', () => { shareToCloud(); exportModal.classList.remove('visible'); });

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

    // Action buttons for assistant messages
    const actions = role === 'assistant' ? `
        <div class="msg-actions">
            <button class="msg-action-btn" onclick="copyMsgText(this)" title="Copy text">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
            </button>
            <button class="msg-action-btn" onclick="downloadMsgPdf(this)" title="Download as PDF">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
                <span>PDF</span>
            </button>
        </div>` : '';

    d.innerHTML = `<div class="msg-inner">
        <div class="msg-avatar">${avatar}</div>
        <div class="msg-content">
            <div class="msg-sender">${name}</div>
            <div class="msg-body">${body}</div>
            ${actions}
        </div>
    </div>`;

    // Store raw markdown on the element for PDF/copy
    if (role === 'assistant') d.dataset.raw = content;

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
        let contextText = text;
        
        // Frontend RAG: If search API is enabled and query asks for search
        if (state.searchApiKey && /search|find|latest|news|competitor|trend|market/i.test(text)) {
            const searchData = await performWebSearch(text);
            if (searchData) {
                contextText = `User Query: ${text}\n\n[Real-time Web Search Results]:\n${searchData}\n\nPlease use the above real-time web context to answer the user's query comprehensively.`;
            }
        }

        const res = await callAPI(contextText);
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
    if (state.searchApiKey) searchApiInput.value = state.searchApiKey;
    if (state.supabaseUrl) supabaseUrlInput.value = state.supabaseUrl;
    if (state.supabaseKey) supabaseKeyInput.value = state.supabaseKey;
}

async function doConnect() {
    const url = gradioUrlInput.value.trim().replace(/\/$/, '');
    state.searchApiKey = searchApiInput.value.trim();
    state.supabaseUrl = supabaseUrlInput.value.trim();
    state.supabaseKey = supabaseKeyInput.value.trim();
    
    localStorage.setItem('am_search_key', state.searchApiKey);
    localStorage.setItem('am_supabase_url', state.supabaseUrl);
    localStorage.setItem('am_supabase_key', state.supabaseKey);

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

// ===== MESSAGE ACTIONS =====
function copyMsgText(btn) {
    const msgEl = btn.closest('.msg');
    if (!msgEl) return;
    const rawText = msgEl.dataset.raw || msgEl.querySelector('.msg-body').textContent;
    navigator.clipboard.writeText(rawText).then(() => {
        const span = btn.querySelector('span');
        const origText = span.textContent;
        span.textContent = 'Copied!';
        btn.style.borderColor = '#10b981';
        btn.style.color = '#10b981';
        setTimeout(() => {
            span.textContent = origText;
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy text. Please try again.');
    });
}

function downloadMsgPdf(btn) {
    const msgEl = btn.closest('.msg');
    if (!msgEl) return;
    
    const bodyEl = msgEl.querySelector('.msg-body');
    if (!bodyEl) return;
    
    const span = btn.querySelector('span');
    const origText = span.textContent;
    span.textContent = 'Generating...';
    btn.disabled = true;
    
    const div = document.createElement('div');
    div.style.cssText = 'padding: 40px; font-family: "Inter", -apple-system, sans-serif; color: #1a1714; max-width: 800px; background: #ffffff; line-height: 1.6;';
    
    const headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f4f1ea; padding-bottom: 15px; margin-bottom: 30px;">
            <div>
                <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #c96442; font-family: 'Inter', sans-serif; letter-spacing: -0.5px;">AetherMind</h1>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #7f7a75; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">AI Startup Mentor for Indian Entrepreneurs</p>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 11px; color: #9c958f; font-weight: 500;">DOCUMENT GENERATED</span>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #4e4a46; font-weight: 600;">${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
        </div>
    `;
    
    const stylesHtml = `
        <style>
            .pdf-content { font-size: 13.5px; color: #2d2a26; }
            .pdf-content p { margin: 0 0 12px 0; }
            .pdf-content h1, .pdf-content h2, .pdf-content h3, .pdf-content h4 { color: #1a1714; font-weight: 600; margin-top: 20px; margin-bottom: 10px; }
            .pdf-content h1 { font-size: 18px; border-bottom: 1px solid #f4f1ea; padding-bottom: 4px; }
            .pdf-content h2 { font-size: 16px; }
            .pdf-content h3 { font-size: 14.5px; }
            .pdf-content ul, .pdf-content ol { margin: 0 0 15px 20px; padding: 0; }
            .pdf-content li { margin-bottom: 6px; }
            .pdf-content strong { color: #c96442; font-weight: 600; }
            .pdf-content blockquote { border-left: 3px solid #c96442; padding-left: 14px; margin: 15px 0; color: #7f7a75; font-style: italic; }
            .pdf-content code { background: #f5f2eb; padding: 2px 5px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
            .pdf-content pre { background: #1e1e2e; color: #cdd6f4; border-radius: 8px; padding: 14px; overflow-x: auto; margin: 15px 0; }
            .pdf-content pre code { background: none; padding: 0; font-size: 11px; }
            .pdf-content table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .pdf-content th, .pdf-content td { border: 1px solid #e6e2da; padding: 8px 12px; text-align: left; font-size: 12.5px; }
            .pdf-content th { background-color: #fcfbfa; font-weight: 600; }
            .pdf-content input[type="checkbox"] { margin-right: 8px; transform: scale(1.1); vertical-align: middle; }
        </style>
    `;
    
    const footerHtml = `
        <div style="margin-top: 40px; border-top: 1px solid #f4f1ea; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #9c958f;">
            <span>AetherMind mentor report. All rights reserved.</span>
            <span>https://aethermind.in</span>
        </div>
    `;
    
    div.innerHTML = stylesHtml + headerHtml + `<div class="pdf-content">${bodyEl.innerHTML}</div>` + footerHtml;
    
    const activeConv = active();
    const titleSnippet = activeConv ? activeConv.title.replace(/[^a-z0-9]/gi, '_').substring(0, 20) : 'Response';
    const filename = `AetherMind_Mentor_${titleSnippet}_${Date.now().toString().substring(8)}.pdf`;
    
    const options = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(options).from(div).save().then(() => {
        span.textContent = 'Downloaded!';
        setTimeout(() => {
            span.textContent = origText;
            btn.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error('PDF generation error:', err);
        span.textContent = origText;
        btn.disabled = false;
        alert('Failed to generate PDF. Please try again.');
    });
}

// ===== UTILS =====
function scrollEnd() { requestAnimationFrame(() => { messagesScroll.scrollTop = messagesScroll.scrollHeight; }); }
function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 150) + 'px'; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

window.loadConv = loadConv;
window.delConv = delConv;
window.copyMsgText = copyMsgText;
window.downloadMsgPdf = downloadMsgPdf;

document.addEventListener('DOMContentLoaded', init);

// ===== CLOUD FEATURES =====
async function performWebSearch(query) {
    if (!state.searchApiKey) return null;
    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: state.searchApiKey,
                query: query,
                search_depth: 'basic',
                include_answer: true,
                max_results: 3
            })
        });
        if (response.ok) {
            const data = await response.json();
            let context = `Web Answer: ${data.answer || 'N/A'}\n\nSources:\n`;
            data.results?.forEach(r => { context += `- ${r.title}: ${r.content}\n`; });
            return context;
        }
    } catch (e) {
        console.error('Search failed:', e);
    }
    return null;
}

async function shareToCloud() {
    const c = active();
    if (!c || !c.messages.length) return alert('No messages to share!');
    if (!state.supabaseUrl || !state.supabaseKey) return alert('Please configure your Supabase URL and Anon Key in Settings to enable Cloud Sharing.');
    
    const pitchId = 'pitch_' + Date.now() + Math.random().toString(36).substring(2, 7);
    try {
        modalStatus.textContent = 'Uploading to cloud...';
        const response = await fetch(`${state.supabaseUrl}/rest/v1/pitches`, {
            method: 'POST',
            headers: {
                'apikey': state.supabaseKey,
                'Authorization': `Bearer ${state.supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ id: pitchId, title: c.title, content: JSON.stringify(c.messages), created_at: new Date().toISOString() })
        });
        
        if (response.ok) {
            const shareUrl = `${window.location.origin}/?pitch=${pitchId}`;
            prompt('Pitch shared successfully! Copy this link:', shareUrl);
        } else {
            const err = await response.text();
            alert('Failed to share. Have you created the "pitches" table in Supabase? ' + err);
        }
    } catch (e) {
        alert('Failed to share: ' + e.message);
    }
}
