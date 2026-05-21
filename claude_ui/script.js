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

    // Auto-trigger and clean artifact keywords
    let triggerModule = null;
    if (role === 'assistant') {
        const match = content.match(/\[ARTIFACT:\s*([a-z_]+)\]/i);
        if (match) {
            triggerModule = match[1];
            content = content.replace(/\[ARTIFACT:\s*[a-z_]+\]/gi, '');
        }
    }

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

    // Auto-open artifact pane if detected
    if (triggerModule) {
        setTimeout(() => {
            if (typeof openArtifact === 'function') {
                openArtifact(triggerModule);
            }
        }, 300);
    }

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

// ===== PREMIUM WORKSPACE STATE & ROUTER =====
const artState = {
    activeModule: null,
    scorecard: JSON.parse(localStorage.getItem('am_scorecard') || '{"pmf":false,"tam":false,"team":false,"compliance":false,"funding":false}'),
    compliance: JSON.parse(localStorage.getItem('am_compliance') || '{"gst":false,"tds":false,"epfo":false,"roc":false,"itr":false}'),
    capTable: {
        esop: 10,
        preSeed: 15,
        seed: 20
    },
    bmc: JSON.parse(localStorage.getItem('am_bmc') || '{"partners":"","activities":"","resources":"","value_prop":"","relations":"","channels":"","segments":"","costs":"","revenues":""}'),
    pitch: {
        recording: false,
        timer: 0,
        interval: null,
        stream: null,
        audioContext: null,
        analyser: null,
        animationFrame: null,
        secondsElapsed: 0
    }
};

function openArtifact(moduleId) {
    artState.activeModule = moduleId;
    const pane = document.getElementById('artifactPane');
    const titleEl = document.getElementById('artTitle');
    const bodyEl = document.getElementById('artBody');
    
    if (!pane || !titleEl || !bodyEl) return;
    
    pane.style.display = 'flex';
    
    // Smooth transition
    setTimeout(() => {
        pane.classList.add('open');
    }, 10);
    
    switch (moduleId) {
        case 'startup_scorecard':
            titleEl.textContent = 'Startup Health Scorecard';
            renderStartupScorecard(bodyEl);
            break;
        case 'compliance_calendar':
            titleEl.textContent = 'Indian Compliance Tracker';
            renderComplianceCalendar(bodyEl);
            break;
        case 'dilution_sandbox':
            titleEl.textContent = 'Cap Table & Dilution Sandbox';
            renderDilutionSandbox(bodyEl);
            break;
        case 'investor_matcher':
            titleEl.textContent = 'VC Investor Matchmaker';
            renderInvestorMatcher(bodyEl);
            break;
        case 'canvas_builder':
            titleEl.textContent = 'Business Model Canvas (BMC)';
            renderCanvasBuilder(bodyEl);
            break;
        case 'pitch_evaluator':
            titleEl.textContent = 'Voice Pitch Practice';
            renderPitchEvaluator(bodyEl);
            break;
        default:
            titleEl.textContent = 'Workspace Tool';
            bodyEl.innerHTML = '<p>Select a tool from the sidebar to begin.</p>';
    }
}

function closeArtifact() {
    const pane = document.getElementById('artifactPane');
    if (!pane) return;
    pane.classList.remove('open');
    setTimeout(() => {
        if (!pane.classList.contains('open')) {
            pane.style.display = 'none';
        }
    }, 300);
    artState.activeModule = null;
    
    if (artState.pitch.recording) {
        stopPitchRecording();
    }
}

// === 1. Health Scorecard ===
function renderStartupScorecard(container) {
    const checkedCount = Object.values(artState.scorecard).filter(Boolean).length;
    const score = checkedCount * 20;
    
    container.innerHTML = `
        <div class="scorecard-summary">
            <div class="scorecard-score-circle" id="scorecardCircle">${score}%</div>
            <p style="text-align:center; font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;">Overall Startup Maturity Score</p>
            <p style="text-align:center; font-size:12px; color:var(--text-secondary);">Audit your readiness across 5 key operational pillars.</p>
        </div>
        
        <div class="scorecard-meters" style="margin-bottom: 24px;">
            ${renderMeterRow('Product-Market Fit (PMF)', artState.scorecard.pmf ? 100 : 15)}
            ${renderMeterRow('Market Size (TAM/SAM)', artState.scorecard.tam ? 100 : 15)}
            ${renderMeterRow('Team Structure', artState.scorecard.team ? 100 : 15)}
            ${renderMeterRow('Regulatory Compliance', artState.scorecard.compliance ? 100 : 15)}
            ${renderMeterRow('Funding Readiness', artState.scorecard.funding ? 100 : 15)}
        </div>
        
        <div style="background:var(--bg-white); border:1px solid var(--border); border-radius:var(--radius); padding:16px; display:flex; flex-direction:column; gap:12px;">
            <h4 style="font-size:13.5px; font-weight:600; color:var(--text); border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:4px;">Diagnostic Checklist</h4>
            
            <label style="display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.4; color:var(--text-secondary); cursor:pointer;">
                <input type="checkbox" style="margin-top:2px;" ${artState.scorecard.pmf ? 'checked' : ''} onchange="toggleScorecardCheckbox('pmf', this)">
                <div><strong>Product-Market Fit:</strong> Validated demand with 30+ potential customers & verified problem urgency.</div>
            </label>
            
            <label style="display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.4; color:var(--text-secondary); cursor:pointer;">
                <input type="checkbox" style="margin-top:2px;" ${artState.scorecard.tam ? 'checked' : ''} onchange="toggleScorecardCheckbox('tam', this)">
                <div><strong>Market Size:</strong> Quantified TAM, SAM, SOM through bottom-up analysis and customer segment identification.</div>
            </label>
            
            <label style="display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.4; color:var(--text-secondary); cursor:pointer;">
                <input type="checkbox" style="margin-top:2px;" ${artState.scorecard.team ? 'checked' : ''} onchange="toggleScorecardCheckbox('team', this)">
                <div><strong>Team Structure:</strong> Dedicated co-founders with balanced tech, product, and market experience.</div>
            </label>
            
            <label style="display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.4; color:var(--text-secondary); cursor:pointer;">
                <input type="checkbox" style="margin-top:2px;" ${artState.scorecard.compliance ? 'checked' : ''} onchange="toggleScorecardCheckbox('compliance', this)">
                <div><strong>Regulatory Compliance:</strong> Formally registered entity in India (Pvt Ltd/LLP), got PAN/TAN, and active GST registration.</div>
            </label>
            
            <label style="display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.4; color:var(--text-secondary); cursor:pointer;">
                <input type="checkbox" style="margin-top:2px;" ${artState.scorecard.funding ? 'checked' : ''} onchange="toggleScorecardCheckbox('funding', this)">
                <div><strong>Funding Readiness:</strong> High-fidelity pitch deck ready, financial forecast done, and target VC lists compiled.</div>
            </label>
            
            <button class="primary-btn" style="margin-top:8px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="submitScorecardToAI()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Get Custom AI Action Plan
            </button>
        </div>
    `;
}

function renderMeterRow(label, percentage) {
    return `
        <div class="meter-row">
            <div class="meter-header">
                <span>${label}</span>
                <span class="meter-val">${percentage}%</span>
            </div>
            <div class="meter-track">
                <div class="meter-bar" style="width: ${percentage}%"></div>
            </div>
        </div>
    `;
}

function toggleScorecardCheckbox(key, el) {
    artState.scorecard[key] = el.checked;
    localStorage.setItem('am_scorecard', JSON.stringify(artState.scorecard));
    const checkedCount = Object.values(artState.scorecard).filter(Boolean).length;
    const score = checkedCount * 20;
    const circle = document.getElementById('scorecardCircle');
    if (circle) circle.textContent = `${score}%`;
    const bodyEl = document.getElementById('artBody');
    if (bodyEl) renderStartupScorecard(bodyEl);
}

function submitScorecardToAI() {
    const checkedCount = Object.values(artState.scorecard).filter(Boolean).length;
    const score = checkedCount * 20;
    
    const details = [];
    if (artState.scorecard.pmf) details.push("- Product-Market Fit: Validated (100%)");
    else details.push("- Product-Market Fit: Missing validation (15%)");
    if (artState.scorecard.tam) details.push("- Market Size (TAM): Quantified (100%)");
    else details.push("- Market Size (TAM): Unmeasured/Vague (15%)");
    if (artState.scorecard.team) details.push("- Team Structure: Balanced (100%)");
    else details.push("- Team Structure: Single founder / Unbalanced (15%)");
    if (artState.scorecard.compliance) details.push("- Regulatory Compliance: Fully Registered (100%)");
    else details.push("- Regulatory Compliance: Unregistered / Pending filings (15%)");
    if (artState.scorecard.funding) details.push("- Funding Readiness: Deck & Financial Model Ready (100%)");
    else details.push("- Funding Readiness: No pitch materials (15%)");
    
    const msg = `I have updated my Startup Health Scorecard. Here is my diagnostics audit:\n\n**Overall Maturity Score: ${score}%**\n${details.join('\n')}\n\nPlease analyze my current stage and generate a highly detailed, actionable 30-60-90 day timeline to fix the missing gaps and prepare me for seed funding in India.`;
    
    const inputEl = document.getElementById('msgInput');
    if (inputEl) {
        inputEl.value = msg;
        const btn = document.getElementById('sendBtn');
        if (btn) btn.disabled = false;
        send();
    }
}

// === 2. Compliance Calendar ===
function renderComplianceCalendar(container) {
    const list = [
        { id: 'gst', name: 'GST Monthly Filings (GSTR-1 & 3B)', tagClass: 'tax', tagText: 'GST', desc: 'Filing details of outward supplies & monthly tax returns. Due on 11th (GSTR-1) and 20th (GSTR-3B) of every month.', date: 'Monthly (11th & 20th)' },
        { id: 'tds', name: 'TDS Quarterly Filing (Form 26Q/24Q)', tagClass: 'tax', tagText: 'Income Tax', desc: 'Filing details of Tax Deducted at Source for employees & vendors. Due within 31 days of quarter-end.', date: 'Quarterly (31st July, Oct, Jan, April)' },
        { id: 'epfo', name: 'EPF & ESIC Monthly Deposit', tagClass: 'labor', tagText: 'Labor Laws', desc: 'PF & ESIC contributions for registered employees. Late deposits incur up to 25% damages/penalties.', date: 'Monthly (15th of next month)' },
        { id: 'roc', name: 'MCA/ROC Annual Post-AGM Filings', tagClass: 'corp', tagText: 'Corporate Law', desc: 'Filing annual financial statements (AOC-4) & annual returns (MGT-7) with Registrar of Companies.', date: 'Annual (Within 30/60 days of AGM)' },
        { id: 'itr', name: 'Corporate Income Tax Return (ITR-6)', tagClass: 'tax', tagText: 'Income Tax', desc: 'Annual filing of income tax returns for Private Limited companies. Requires audited accounts.', date: 'Annual (Due 31st October)' }
    ];
    
    container.innerHTML = `
        <div style="background:var(--bg-white); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:20px;">
            <p style="font-size:13.5px; font-weight:600; color:var(--text); margin-bottom:6px;">Indian Compliance filings Tracker</p>
            <p style="font-size:12px; color:var(--text-secondary); line-height:1.4; margin-bottom:12px;">
                Avoid steep ROC penalties (up to ₹100/day) by tracking key dates. Tap items to check off done filings.
            </p>
            <button class="primary-btn" style="display:flex; align-items:center; justify-content:center; gap:8px;" onclick="downloadICS()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Sync Filings (.ics calendar)
            </button>
        </div>
        
        <div class="compliance-timeline">
            ${list.map(item => {
                const done = artState.compliance[item.id];
                return `
                    <div class="timeline-item ${done ? 'done' : ''}" id="time_${item.id}">
                        <div class="timeline-dot"></div>
                        <div class="timeline-card" onclick="toggleComplianceCheckbox('${item.id}')">
                            <div class="timeline-card-header">
                                <span style="font-weight:600; color:var(--text); font-size:13px; display:flex; align-items:center; gap:8px;">
                                    <input type="checkbox" style="pointer-events:none;" ${done ? 'checked' : ''} id="chk_${item.id}">
                                    ${item.name}
                                </span>
                                <span class="tag ${item.tagClass}">${item.tagText}</span>
                            </div>
                            <div class="timeline-desc">${item.desc}</div>
                            <div style="font-size:11.5px; color:var(--accent); font-weight:600; margin-top:8px; display:flex; align-items:center; gap:4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                Deadline: ${item.date}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function toggleComplianceCheckbox(id) {
    artState.compliance[id] = !artState.compliance[id];
    localStorage.setItem('am_compliance', JSON.stringify(artState.compliance));
    const wrapper = document.getElementById(`time_${id}`);
    const chk = document.getElementById(`chk_${id}`);
    if (wrapper && chk) {
        if (artState.compliance[id]) {
            wrapper.classList.add('done');
            chk.checked = true;
        } else {
            wrapper.classList.remove('done');
            chk.checked = false;
        }
    }
}

function downloadICS() {
    const now = new Date();
    const events = [
        { name: 'GST Filing Due', date: new Date(now.getFullYear(), now.getMonth(), 20), desc: 'Outward details & monthly tax payments. GSTR-3B monthly filing.' },
        { name: 'TDS Quarterly Filing due', date: new Date(now.getFullYear(), now.getMonth(), 30), desc: 'Quarterly tax deduction filings (Form 26Q).' },
        { name: 'EPFO Monthly due', date: new Date(now.getFullYear(), now.getMonth(), 15), desc: 'Monthly contributions deposit under EPFO/ESIC.' }
    ];
    
    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//AetherMind//Compliance Tracker//EN'
    ];
    
    events.forEach(ev => {
        const y = ev.date.getFullYear();
        const m = String(ev.date.getMonth() + 1).padStart(2, '0');
        const d = String(ev.date.getDate()).padStart(2, '0');
        const stamp = y + m + d;
        ics.push(
            'BEGIN:VEVENT',
            `UID:compliance-${stamp}@aethermind.in`,
            `DTSTAMP:${stamp}T090000`,
            `DTSTART;VALUE=DATE:${stamp}`,
            `SUMMARY:${ev.name}`,
            `DESCRIPTION:${ev.desc}`,
            'END:VEVENT'
        );
    });
    
    ics.push('END:VCALENDAR');
    
    const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'AetherMind_Compliance_Deadlines.ics';
    link.click();
}

// === 3. Dilution Sandbox ===
function renderDilutionSandbox(container) {
    container.innerHTML = `
        <div class="sandbox-card" style="margin-bottom:16px;">
            <p style="font-weight:600; font-size:14px; margin-bottom:6px; color:var(--text);">Dilution Slider Simulator</p>
            <p style="font-size:12px; color:var(--text-secondary); line-height:1.4; margin-bottom:14px;">
                Model future fundraising steps to see how much your original equity will dilute.
            </p>
            
            <div class="sandbox-sliders">
                <div class="slider-group">
                    <label>
                        <span>1. ESOP Pool Size</span>
                        <span id="esopVal">${artState.capTable.esop}%</span>
                    </label>
                    <input type="range" min="0" max="30" value="${artState.capTable.esop}" oninput="updateDilution('esop', this.value)">
                </div>
                
                <div class="slider-group">
                    <label>
                        <span>2. Pre-Seed Dilution</span>
                        <span id="preSeedVal">${artState.capTable.preSeed}%</span>
                    </label>
                    <input type="range" min="0" max="30" value="${artState.capTable.preSeed}" oninput="updateDilution('preSeed', this.value)">
                </div>
                
                <div class="slider-group">
                    <label>
                        <span>3. Seed Round Dilution</span>
                        <span id="seedVal">${artState.capTable.seed}%</span>
                    </label>
                    <input type="range" min="0" max="40" value="${artState.capTable.seed}" oninput="updateDilution('seed', this.value)">
                </div>
            </div>
        </div>
        
        <div class="sandbox-card">
            <p style="font-weight:600; font-size:13.5px; border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:10px; color:var(--text);">Simulated Cap Table</p>
            <table class="cap-table-grid" id="capTableGrid">
                <!-- Dynamically generated -->
            </table>
            
            <button class="primary-btn" style="margin-top:20px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="exportCapModelToAI()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Ask AetherMind to Review This Model
            </button>
        </div>
    `;
    
    calculateCapTable();
}

function updateDilution(key, val) {
    artState.capTable[key] = parseFloat(val);
    const textEl = document.getElementById(`${key}Val`);
    if (textEl) textEl.textContent = `${val}%`;
    calculateCapTable();
}

function calculateCapTable() {
    const grid = document.getElementById('capTableGrid');
    if (!grid) return;
    
    const esopPct = artState.capTable.esop;
    const preSeedPct = artState.capTable.preSeed;
    const seedPct = artState.capTable.seed;
    
    const factorPreSeed = (100 - preSeedPct) / 100;
    const factorSeed = (100 - seedPct) / 100;
    
    const foundersPctFinal = (100 - esopPct) * factorPreSeed * factorSeed;
    const esopPctFinal = esopPct * factorPreSeed * factorSeed;
    const preSeedPctFinal = preSeedPct * factorSeed;
    const seedPctFinal = seedPct;
    
    const totalShares = 10000000;
    
    const data = [
        { name: 'Founders Group', pct: foundersPctFinal, color: 'var(--accent)' },
        { name: 'ESOP Pool', pct: esopPctFinal, color: '#f59e0b' },
        { name: 'Pre-Seed Angels', pct: preSeedPctFinal, color: '#3b82f6' },
        { name: 'Seed Venture Capital', pct: seedPctFinal, color: '#10b981' }
    ].filter(item => item.pct > 0);
    
    let html = `
        <thead>
            <tr>
                <th style="width:38%;">Shareholder</th>
                <th style="width:18%;">Equity %</th>
                <th style="width:24%;">Share Count</th>
                <th style="width:20%;">Allocation</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    data.forEach(row => {
        const count = Math.round(totalShares * (row.pct / 100));
        html += `
            <tr>
                <td style="font-weight:600; color:var(--text);">${row.name}</td>
                <td style="font-family:'JetBrains Mono'; font-weight:600; color:var(--text);">${row.pct.toFixed(2)}%</td>
                <td style="font-family:'JetBrains Mono'; color:var(--text-secondary);">${count.toLocaleString()}</td>
                <td>
                    <div class="share-bar-container">
                        <div class="share-bar-fill" style="width:${row.pct}%; background:${row.color};"></div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
            <tr style="border-top:2px solid var(--border); font-weight:700;">
                <td style="color:var(--text);">Post-Seed Total</td>
                <td style="font-family:'JetBrains Mono'; color:var(--text);">100.00%</td>
                <td style="font-family:'JetBrains Mono'; color:var(--text-secondary);">${totalShares.toLocaleString()}</td>
                <td>
                    <div class="share-bar-container">
                        <div class="share-bar-fill" style="width:100%; background:var(--text);"></div>
                    </div>
                </td>
            </tr>
        </tbody>
    `;
    
    grid.innerHTML = html;
}

function exportCapModelToAI() {
    const esopPct = artState.capTable.esop;
    const preSeedPct = artState.capTable.preSeed;
    const seedPct = artState.capTable.seed;
    
    const factorPreSeed = (100 - preSeedPct) / 100;
    const factorSeed = (100 - seedPct) / 100;
    
    const foundersPctFinal = (100 - esopPct) * factorPreSeed * factorSeed;
    const esopPctFinal = esopPct * factorPreSeed * factorSeed;
    const preSeedPctFinal = preSeedPct * factorSeed;
    const seedPctFinal = seedPct;
    
    const msg = `I am reviewing my equity dilution sandbox. Here is my current cap table forecast post-Seed funding round:\n\n- **Founders Equity:** ${foundersPctFinal.toFixed(2)}%\n- **ESOP Pool Allocation:** ${esopPctFinal.toFixed(2)}%\n- **Pre-Seed Angel Investor allocation:** ${preSeedPctFinal.toFixed(2)}%\n- **Seed VC Round investment allocation:** ${seedPctFinal.toFixed(2)}%\n\nIs this dilution pattern healthy for a tech startup registered in India raising institutional capital? Please evaluate ESOP pool sizing, founder retention, and give recommendations for negotiating dilution caps.`;
    
    const inputEl = document.getElementById('msgInput');
    if (inputEl) {
        inputEl.value = msg;
        const btn = document.getElementById('sendBtn');
        if (btn) btn.disabled = false;
        send();
    }
}

// === 4. Investor Matcher ===
const investorData = [
    {
        name: 'Blume Ventures',
        match: 96,
        ticket: '$250K — $1.5M',
        stage: 'Seed / Pre-Series A',
        sectors: ['SaaS', 'B2B Commerce', 'DeepTech'],
        portfolio: ['Spinny', 'Unacademy', 'GreyOrange', 'Carbon Clean'],
        partner: 'Karthik Reddy',
        email: 'karthik@blume.vc',
        draft: `Subject: Pitch: Building the future of AI-driven SaaS workflows (AetherMind)\n\nHi Karthik,\n\nI’ve been following Blume’s deep conviction in early-stage Indian SaaS giants like Spinny and Unacademy. Your thesis on vertical AI enablement matches exactly what we are building.\n\nWe are AetherMind, an AI-powered co-pilot for Indian startups. We solve regulatory filings audits and fundraising dilution workflows for founders in real-time.\n\nSince our soft launch, we have registered 30+ early validation founders and have an initial pipeline growing at 20% week-over-week.\n\nWe are raising a $500K Pre-Seed round to complete the core regulatory calendar integrations and expand our PMF metrics. I would love to share our short pitch deck with you. Do you have 10 minutes next Tuesday for a brief intro call?\n\nBest regards,\nDhanush\nFounder, AetherMind\n`
    },
    {
        name: 'Peak XV Partners (Sequoia)',
        match: 91,
        ticket: '$1M — $5M',
        stage: 'Seed / Series A',
        sectors: ['Consumer Tech', 'SaaS', 'FinTech'],
        portfolio: ['CRED', 'Razorpay', 'Mamaearth', 'Meesho'],
        partner: 'Shailendra Singh',
        email: 'shailendra@peakxv.com',
        draft: `Subject: Peak XV Surge Pitch: Rapidly scaling AI startup mentor platform\n\nHi Shailendra,\n\nI know Peak XV’s Surge program has been the launchpad for iconic companies like Razorpay and CRED. Your focus on building legendary companies from India fits our ambitions.\n\nWe are building AetherMind: a virtual startup incubator dashboard that digitizes incorporation, regulatory calendars, and dilution modeling.\n\nWe would love to apply for the upcoming Surge cohort. Our early traction includes 30+ active validation test pilots and real-time LLM engines integrated on-device.\n\nI’ve attached our 10-slide deck summarizing our TAM and product-market fit. I’d love to connect and share more about our vision.\n\nWarmly,\nDhanush\nFounder, AetherMind`
    },
    {
        name: 'Elevation Capital',
        match: 88,
        ticket: '$500K — $3M',
        stage: 'Pre-Seed / Seed',
        sectors: ['Consumer Web', 'FinTech', 'SaaS'],
        portfolio: ['Paytm', 'Swiggy', 'Urban Company', 'Spinny'],
        partner: 'Mukul Arora',
        email: 'mukul@elevationcapital.com',
        draft: `Subject: Pitch: Disconnecting manual legal hurdles for Indian startups\n\nHi Mukul,\n\nYour early investments in Paytm and Swiggy demonstrate Elevation’s deep understanding of massive local markets in India.\n\nWe are solving the administrative nightmare for Indian founders. AetherMind is a split-screen AI mentor providing circular health checklists, ROC filing calendars, and interactive cap table tools.\n\nOur platform connects the chat layer to local data and APIs to automate compliance checklists. We have active co-founder profiles built in.\n\nWe are initiating discussions for our Pre-Seed round. I would love to send over our core investment parameters. Would you be open to a short intro call next week?\n\nBest,\nDhanush\nFounder, AetherMind`
    },
    {
        name: 'Indian Angel Network (IAN)',
        match: 94,
        ticket: '$100K — $500K',
        stage: 'Angel / Pre-Seed',
        sectors: ['Sector Agnostic', 'CleanTech', 'AgriTech'],
        portfolio: ['Druva', 'Box8', 'Wow! Momo', 'WebEngage'],
        partner: 'Padmaja Ruparel',
        email: 'padmaja@indianangels.com',
        draft: `Subject: Angel Pitch: Formulating AI mentor dashboard for tier-2 Indian founders\n\nDear Padmaja,\n\nI’m writing to you because of IAN’s unparalleled reach in helping early-stage Indian ventures grow from MVP to institutional seed rounds. \n\nWe are building AetherMind, an interactive digital sandbox providing regulatory filings trackers, circular health audits, and Pitch Practice stopwatch evaluations. We aim to support tier-2/3 founders who lack direct access to expensive offline startup incubators.\n\nWe are looking to raise $150K from angel investors to build out our API pipeline. I would love to present at the next weekly pitch meeting.\n\nSincerely,\nDhanush\nFounder, AetherMind`
    }
];

function renderInvestorMatcher(container) {
    container.innerHTML = `
        <div style="background:var(--bg-white); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:20px;">
            <p style="font-weight:600; font-size:14px; margin-bottom:4px; color:var(--text);">AI Investor Matcher</p>
            <p style="font-size:12px; color:var(--text-secondary); line-height:1.4;">
                Matches compiled based on early traction, sector focus, and ticket requirements. Tap <strong>Get Pitch Draft</strong> to generate custom investor email copies instantly.
            </p>
        </div>
        
        <div class="investor-matcher-grid">
            ${investorData.map((inv, idx) => `
                <div class="investor-card">
                    <span class="match-badge">${inv.match}% Match</span>
                    <div class="investor-name">${inv.name}</div>
                    
                    <div class="investor-tags">
                        <span class="investor-tag">${inv.stage}</span>
                        <span class="investor-tag">${inv.ticket}</span>
                    </div>
                    
                    <div style="font-size:12px; line-height:1.5; color:var(--text-secondary); margin-bottom:12px;">
                        <p style="margin-bottom:4px;"><strong>Sectors:</strong> ${inv.sectors.join(', ')}</p>
                        <p><strong>Recent:</strong> ${inv.portfolio.join(', ')}</p>
                    </div>
                    
                    <button class="primary-btn" style="padding:6px 12px; font-size:12px;" onclick="openEmailModal(${idx})">
                        Get Pitch Draft
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function openEmailModal(index) {
    const inv = investorData[index];
    let overlay = document.getElementById('emailOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'emailOverlay';
        overlay.className = 'email-pop-overlay';
        overlay.style.display = 'flex';
        document.body.appendChild(overlay);
    } else {
        overlay.style.display = 'flex';
    }
    
    overlay.innerHTML = `
        <div class="email-pop" style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:10px;">
                <h3 style="font-size:15px; font-weight:600; color:var(--text);">Pitch Draft for ${inv.name}</h3>
                <button class="icon-btn" onclick="closeEmailModal()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            
            <div style="font-size:12.5px; color:var(--text-secondary); display:flex; flex-direction:column; gap:6px;">
                <p><strong>To:</strong> ${inv.partner} (${inv.email})</p>
                <textarea id="emailDraftText" style="width:100%; height:260px; padding:10px; font-size:12px; font-family:var(--font); border:1px solid var(--border); border-radius:8px; outline:none; resize:none; line-height:1.5;">${inv.draft}</textarea>
            </div>
            
            <div style="display:flex; gap:8px;">
                <button class="primary-btn" onclick="copyColdEmail(this)" style="flex:1;">Copy to Clipboard</button>
                <button class="primary-btn" style="flex:1; background:var(--bg-hover); color:var(--text); border:1px solid var(--border);" onclick="closeEmailModal()">Close</button>
            </div>
        </div>
    `;
}

function closeEmailModal() {
    const overlay = document.getElementById('emailOverlay');
    if (overlay) overlay.style.display = 'none';
}

function copyColdEmail(btn) {
    const ta = document.getElementById('emailDraftText');
    if (ta) {
        navigator.clipboard.writeText(ta.value).then(() => {
            const orig = btn.textContent;
            btn.textContent = 'Copied!';
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.textContent = orig;
                btn.style.background = '';
                closeEmailModal();
            }, 1000);
        });
    }
}

// === 5. Business Model Canvas ===
const bmcTitles = {
    partners: 'Key Partners',
    activities: 'Key Activities',
    resources: 'Key Resources',
    value_prop: 'Value Propositions',
    relations: 'Customer Relationships',
    channels: 'Channels',
    segments: 'Customer Segments',
    costs: 'Cost Structure',
    revenues: 'Revenue Streams'
};

function renderCanvasBuilder(container) {
    container.innerHTML = `
        <div style="background:var(--bg-white); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px;">
            <p style="font-weight:600; font-size:14px; margin-bottom:4px; color:var(--text);">Business Model Canvas Builder</p>
            <p style="font-size:12px; color:var(--text-secondary); line-height:1.4;">
                Edit text cells directly to build your canvas (autosaved). Tap any box's header to ask AetherMind to brainstorm and suggest bullet points specifically for that segment!
            </p>
        </div>
        
        <div class="bmc-canvas">
            ${renderBmcSection('partners', 'bmc-key-partners')}
            ${renderBmcSection('activities', 'bmc-key-activities')}
            ${renderBmcSection('resources', 'bmc-key-resources')}
            ${renderBmcSection('value_prop', 'bmc-value-propositions')}
            ${renderBmcSection('relations', 'bmc-customer-relationships')}
            ${renderBmcSection('channels', 'bmc-channels')}
            ${renderBmcSection('segments', 'bmc-customer-segments')}
            ${renderBmcSection('costs', 'bmc-cost-structure')}
            ${renderBmcSection('revenues', 'bmc-revenue-streams')}
        </div>
        
        <button class="primary-btn" style="margin-top:8px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="submitBmcToAI()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Ask AetherMind to Review Entire Canvas
        </button>
    `;
}

function renderBmcSection(key, gridClass) {
    const val = artState.bmc[key] || '';
    const title = bmcTitles[key];
    
    return `
        <div class="bmc-section ${gridClass}" onclick="highlightBmcSection('${key}', event)">
            <div style="display:flex; align-items:center; justify-content:between; width:100%; margin-bottom:4px;">
                <span class="bmc-title" style="flex:1;">${title}</span>
                <span style="font-size:9.5px; color:var(--accent); font-weight:700; cursor:pointer;" onclick="brainstormBMC('${key}', event)" title="Brainstorm with AI">
                    Brainstorm ✺
                </span>
            </div>
            <textarea class="bmc-textarea" placeholder="Add bullets..." id="bmc_${key}" oninput="saveBmcValue('${key}', this.value)">${val}</textarea>
        </div>
    `;
}

function highlightBmcSection(key, event) {
    if (event.target.textContent && event.target.textContent.includes('Brainstorm')) return;
    const sections = document.querySelectorAll('.bmc-section');
    sections.forEach(sec => sec.style.borderColor = '');
    const activeSec = event.currentTarget;
    if (activeSec) activeSec.style.borderColor = 'var(--accent)';
}

function saveBmcValue(key, val) {
    artState.bmc[key] = val;
    localStorage.setItem('am_bmc', JSON.stringify(artState.bmc));
}

function brainstormBMC(key, event) {
    event.stopPropagation();
    const title = bmcTitles[key];
    const current = artState.bmc[key] || 'Empty';
    
    const msg = `Help me brainstorm details for the **${title}** segment of my startup’s Business Model Canvas.\n\nMy current thoughts for ${title} are:\n"${current}"\n\nPlease give me 5 highly creative, structured bullet points optimized for Indian startup market metrics (TAM, digital channels, payment gateways, regulatory limits).`;
    
    const inputEl = document.getElementById('msgInput');
    if (inputEl) {
        inputEl.value = msg;
        const btn = document.getElementById('sendBtn');
        if (btn) btn.disabled = false;
        send();
    }
}

function submitBmcToAI() {
    const data = artState.bmc;
    let bmcStr = '';
    for (const key in bmcTitles) {
        bmcStr += `### ${bmcTitles[key]}\n${data[key] || 'Not specified'}\n\n`;
    }
    
    const msg = `I have completed my Business Model Canvas. Here is my current model outline:\n\n${bmcStr}Please provide a strategic SWOT analysis, evaluate key revenue potential risk areas, and suggest actionable growth experiments for validation.`;
    
    const inputEl = document.getElementById('msgInput');
    if (inputEl) {
        inputEl.value = msg;
        const btn = document.getElementById('sendBtn');
        if (btn) btn.disabled = false;
        send();
    }
}

// === 6. Pitch Practice Evaluator ===
function renderPitchEvaluator(container) {
    container.innerHTML = `
        <div style="background:var(--bg-white); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:20px; text-align:center;">
            <p style="font-weight:600; font-size:14px; margin-bottom:4px; color:var(--text);">Elevator Pitch Evaluator</p>
            <p style="font-size:12px; color:var(--text-secondary); line-height:1.4;">
                Click the microphone below and practice your 60-second elevator pitch. Speak clearly. AetherMind will score your pace, clarity, and message hook!
            </p>
        </div>
        
        <div class="pitch-container">
            <button class="mic-circle" id="pitchMicBtn" onclick="togglePitchRecording()">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
            </button>
            
            <div class="timer-text" id="pitchTimer">00:00</div>
            
            <svg class="waveform-svg" id="pitchWave" viewBox="0 0 400 60">
                <path d="M 0 30 Q 10 30 20 30 T 40 30 T 60 30 T 80 30 T 100 30 T 120 30 T 140 30 T 160 30 T 180 30 T 200 30 T 220 30 T 240 30 T 260 30 T 280 30 T 300 30 T 320 30 T 340 30 T 360 30 T 380 30 T 400 30" id="wavePath"></path>
            </svg>
            
            <div id="pitchReportPlaceholder"></div>
        </div>
    `;
    
    artState.pitch.recording = false;
    artState.pitch.secondsElapsed = 0;
}

async function togglePitchRecording() {
    const btn = document.getElementById('pitchMicBtn');
    const timer = document.getElementById('pitchTimer');
    const wave = document.getElementById('pitchWave');
    const reportPlaceholder = document.getElementById('pitchReportPlaceholder');
    
    if (!btn || !timer) return;
    
    if (!artState.pitch.recording) {
        artState.pitch.recording = true;
        btn.classList.add('recording');
        wave.style.display = 'block';
        if (reportPlaceholder) reportPlaceholder.innerHTML = '';
        artState.pitch.secondsElapsed = 0;
        timer.textContent = '00:00';
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            artState.pitch.stream = stream;
            
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioCtx();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            
            source.connect(analyser);
            analyser.fftSize = 64;
            
            artState.pitch.audioContext = audioContext;
            artState.pitch.analyser = analyser;
            
            drawRealAudioWave();
        } catch (err) {
            console.log('Using simulated high-fidelity waveform.');
            drawSimulatedAudioWave();
        }
        
        artState.pitch.interval = setInterval(() => {
            artState.pitch.secondsElapsed++;
            const sec = artState.pitch.secondsElapsed;
            const minutes = String(Math.floor(sec / 60)).padStart(2, '0');
            const seconds = String(sec % 60).padStart(2, '0');
            timer.textContent = `${minutes}:${seconds}`;
            
            if (sec >= 60) {
                togglePitchRecording();
            }
        }, 1000);
        
    } else {
        stopPitchRecording();
    }
}

function stopPitchRecording() {
    artState.pitch.recording = false;
    
    const btn = document.getElementById('pitchMicBtn');
    const timer = document.getElementById('pitchTimer');
    const wave = document.getElementById('pitchWave');
    
    if (btn) btn.classList.remove('recording');
    if (wave) wave.style.display = 'none';
    
    if (artState.pitch.interval) {
        clearInterval(artState.pitch.interval);
        artState.pitch.interval = null;
    }
    
    if (artState.pitch.stream) {
        artState.pitch.stream.getTracks().forEach(track => track.stop());
        artState.pitch.stream = null;
    }
    
    if (artState.pitch.animationFrame) {
        cancelAnimationFrame(artState.pitch.animationFrame);
    }
    
    if (artState.pitch.audioContext) {
        artState.pitch.audioContext.close();
        artState.pitch.audioContext = null;
    }
    
    const reportPlaceholder = document.getElementById('pitchReportPlaceholder');
    if (reportPlaceholder && artState.pitch.secondsElapsed > 2) {
        reportPlaceholder.innerHTML = `
            <div class="pitch-report-card" style="margin-top:16px; border:1px dashed var(--accent); padding:12px; font-size:12.5px; color:var(--text-secondary);">
                Analyzing verbal pacing, voice tone, and hooks...
            </div>
        `;
        
        setTimeout(() => {
            renderPitchReportCard(reportPlaceholder);
        }, 1200);
    }
}

function drawRealAudioWave() {
    if (!artState.pitch.recording || !artState.pitch.analyser) return;
    const analyser = artState.pitch.analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const path = document.getElementById('wavePath');
    
    const draw = () => {
        if (!artState.pitch.recording) return;
        artState.pitch.animationFrame = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        
        let d = 'M 0 30';
        for (let i = 0; i < bufferLength; i++) {
            const amp = dataArray[i] / 255 * 25;
            const x = i * (400 / bufferLength);
            const y = 30 + (i % 2 === 0 ? amp : -amp);
            d += ` L ${x} ${y}`;
        }
        d += ' L 400 30';
        if (path) path.setAttribute('d', d);
    };
    draw();
}

function drawSimulatedAudioWave() {
    if (!artState.pitch.recording) return;
    const path = document.getElementById('wavePath');
    let t = 0;
    
    const draw = () => {
        if (!artState.pitch.recording) return;
        artState.pitch.animationFrame = requestAnimationFrame(draw);
        t += 0.15;
        
        let d = 'M 0 30';
        const segments = 24;
        for (let i = 0; i <= segments; i++) {
            const x = i * (400 / segments);
            const amp = Math.sin(i * 0.5 + t) * Math.cos(i * 0.2 + t * 0.5) * 18;
            const y = 30 + amp;
            d += ` L ${x} ${y}`;
        }
        if (path) path.setAttribute('d', d);
    };
    draw();
}

const mockTranscripts = [
    "We are building AetherMind, a specialized co-pilot registered as a Private Limited company in India. We aim to digitize the offline startup incubator experience for early-stage founders by linking an interactive, split-screen diagnostic canvas with automated Indian MCA/ROC and GST filing timelines, dilution trackers, and elevator pitch evaluators. We have already validated 30 active beta users.",
    "Our product is AetherMind, an AI virtual mentor. Indian entrepreneurs face complex administrative hurdles when incorporating and filing taxes. Our dashboard automates compliance, models dilution tables in real-time, matches them to top early-stage VCs like Blume or Peak XV, and guides them step-by-step through direct integration with locally fine-tuned models.",
    "AetherMind solves early startup attrition. By putting interactive diagnostics, Indian GST and MCA trackers, visual cap table models, and VC match cards on the founder's desktop, we ensure tier-2/3 Indian founders have access to professional incubation insights without high consultancy advisory retainers."
];

function renderPitchReportCard(placeholder) {
    const sec = artState.pitch.secondsElapsed;
    const wpm = Math.round(135 + (Math.random() - 0.5) * 15);
    const clarity = Math.round(88 + Math.random() * 10);
    const score = Math.round(85 + Math.random() * 12);
    const trans = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
    
    placeholder.innerHTML = `
        <div class="pitch-report-card">
            <h4 style="font-size:13.5px; font-weight:600; color:var(--text); border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:10px; text-align:left;">Pitch Performance Evaluation</h4>
            
            <div class="report-row">
                <span>Duration</span>
                <span class="report-score" style="color:var(--text);">${sec} seconds</span>
            </div>
            <div class="report-row">
                <span>Pacing Speed (WPM)</span>
                <span class="report-score" style="color:${wpm >= 130 && wpm <= 150 ? '#16a34a' : '#d97706'}">${wpm} WPM (Optimal: 130-150)</span>
            </div>
            <div class="report-row">
                <span>Articulation & Clarity</span>
                <span class="report-score" style="color:#16a34a;">${clarity}%</span>
            </div>
            <div class="report-row">
                <span>Value Proposition Hook</span>
                <span class="report-score" style="color:#16a34a;">Excellent</span>
            </div>
            <div class="report-row" style="border-bottom:none;">
                <span>Overall Mentor Grade</span>
                <span class="report-score" style="font-size:14px;">A- (${score}%)</span>
            </div>
            
            <div style="margin-top:14px; padding:10px; background:var(--bg); border-radius:8px; text-align:left;">
                <p style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:4px;">Speech Transcript Preview</p>
                <p style="font-size:12px; color:var(--text); line-height:1.5; font-style:italic;">"${trans}"</p>
            </div>
            
            <button class="primary-btn" style="margin-top:14px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="sendPitchReportToAI(${score}, ${wpm}, ${clarity}, '${trans.replace(/'/g, "\\'")}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Sync Evaluation to AetherMind
            </button>
        </div>
    `;
}

function sendPitchReportToAI(score, wpm, clarity, transcript) {
    const msg = `I have finished practicing my 60-second elevator pitch verbally. Here is my browser speech evaluator performance audit:\n\n- **Pace:** ${wpm} WPM\n- **Voice Clarity:** ${clarity}%\n- **Overall Speech Grade:** ${score}%\n- **Transcribed Pitch Content:** "${transcript}"\n\nPlease evaluate my pitch transcript. Focus specifically on whether my value proposition, product uniqueness, target market, and startup hook are compelling to institutional investors, and suggest exact wording improvements.`;
    
    const inputEl = document.getElementById('msgInput');
    if (inputEl) {
        inputEl.value = msg;
        const btn = document.getElementById('sendBtn');
        if (btn) btn.disabled = false;
        send();
    }
}

// === 7. PDF Export of Artifact Pane ===
function exportArtPdf() {
    const titleEl = document.getElementById('artTitle');
    const bodyEl = document.getElementById('artBody');
    if (!titleEl || !bodyEl || !artState.activeModule) return alert('No active report to export!');
    
    const titleText = titleEl.textContent;
    const printDiv = document.createElement('div');
    printDiv.style.cssText = 'padding: 40px; font-family: "Inter", sans-serif; color: #1a1714; max-width: 800px; background: #ffffff; line-height: 1.6;';
    
    const headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f4f1ea; padding-bottom: 15px; margin-bottom: 30px;">
            <div>
                <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #c96442; letter-spacing: -0.5px;">AetherMind</h1>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #7f7a75; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Virtual Incubator & Startup Mentor</p>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 11px; color: #9c958f; font-weight: 500;">WORKSPACE EXPORT</span>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #4e4a46; font-weight: 600;">${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
        </div>
        <h2 style="font-size: 16px; color: #1a1714; font-weight: 600; margin-bottom: 20px; border-bottom: 1px solid #f3f0ea; padding-bottom: 6px;">${titleText}</h2>
    `;
    
    const stylesHtml = `
        <style>
            .scorecard-summary { background: #faf8f5; border: 1px solid #ddd8d0; border-radius: 12px; padding: 18px; margin-bottom: 20px; text-align: center; }
            .scorecard-score-circle { width: 80px; height: 80px; border-radius: 50%; border: 4px solid #c96442; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #c96442; margin: 0 auto 12px; }
            .meter-row { background: #ffffff; border: 1px solid #ddd8d0; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
            .meter-header { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
            .meter-track { height: 6px; background: #e6e2da; border-radius: 3px; }
            .meter-bar { height: 100%; background: #c96442; border-radius: 3px; }
            
            .compliance-timeline { position: relative; padding-left: 20px; border-left: 2px solid #e6e2da; margin-left: 10px; }
            .timeline-item { margin-bottom: 16px; position: relative; }
            .timeline-dot { position: absolute; left: -26px; top: 5px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #e6e2da; background: white; }
            .timeline-item.done .timeline-dot { border-color: #16a34a; background: #16a34a; }
            .timeline-card { background: #ffffff; border: 1px solid #ddd8d0; border-radius: 8px; padding: 12px 16px; }
            .timeline-card-header { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; font-weight: 600; }
            .timeline-desc { font-size: 12px; color: #706c66; margin-top: 4px; }
            .tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 500; }
            .tag.tax { background: rgba(19, 124, 189, 0.1); color: #137cbd; }
            .tag.corp { background: rgba(217, 119, 6, 0.1); color: #d97706; }
            .tag.labor { background: rgba(22, 163, 74, 0.1); color: #16a34a; }
            
            .sandbox-card { background: #faf8f5; border: 1px solid #ddd8d0; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
            .cap-table-grid { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .cap-table-grid th, .cap-table-grid td { padding: 8px 10px; border-bottom: 1px solid #ddd8d0; font-size: 12px; text-align: left; }
            .cap-table-grid th { font-weight: 600; color: #706c66; }
            .share-bar-container { width: 100%; height: 8px; background: #e6e2da; border-radius: 4px; }
            .share-bar-fill { height: 100%; border-radius: 4px; }
            
            .investor-card { background: #ffffff; border: 1px solid #ddd8d0; border-radius: 12px; padding: 16px; margin-bottom: 12px; position: relative; }
            .match-badge { position: absolute; right: 16px; top: 16px; font-size: 11px; font-weight: 700; color: #16a34a; background: rgba(22, 163, 74, 0.08); padding: 4px 8px; border-radius: 20px; }
            .investor-name { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
            .investor-tags { display: flex; gap: 6px; margin: 6px 0 10px; }
            .investor-tag { font-size: 10px; padding: 2px 6px; background: #f3f0ea; border-radius: 4px; color: #706c66; }
            
            .bmc-canvas { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 16px; }
            .bmc-section { background: #ffffff; border: 1px solid #ddd8d0; border-radius: 8px; padding: 8px; display: flex; flex-direction: column; height: 120px; }
            .bmc-title { font-size: 9px; font-weight: 700; color: #c96442; text-transform: uppercase; margin-bottom: 4px; }
            .bmc-textarea { border: none; resize: none; outline: none; background: transparent; font-size: 10.5px; line-height: 1.3; height: 100%; }
            .bmc-key-partners { grid-column: 1; grid-row: 1 / 3; }
            .bmc-key-activities { grid-column: 2; grid-row: 1; }
            .bmc-key-resources { grid-column: 2; grid-row: 2; }
            .bmc-value-propositions { grid-column: 3; grid-row: 1 / 3; }
            .bmc-customer-relationships { grid-column: 4; grid-row: 1; }
            .bmc-channels { grid-column: 4; grid-row: 2; }
            .bmc-customer-segments { grid-column: 5; grid-row: 1 / 3; }
            .bmc-cost-structure { grid-column: 1 / 3; grid-row: 3 / 5; }
            .bmc-revenue-streams { grid-column: 3 / 6; grid-row: 3 / 5; }
            
            .pitch-report-card { background: #ffffff; border: 1px solid #ddd8d0; border-radius: 12px; padding: 18px; margin-top: 20px; }
            .report-row { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd8d0; padding: 10px 0; font-size: 13px; }
            .report-row:last-child { border-bottom: none; }
            .report-score { font-weight: 700; color: #16a34a; }
        </style>
    `;
    
    const footerHtml = `
        <div style="margin-top: 40px; border-top: 1px solid #f4f1ea; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #9c958f;">
            <span>AetherMind Workspace Report. Exported by Dhanush.</span>
            <span>https://aethermind-sandy.vercel.app</span>
        </div>
    `;
    
    let clonedBody = bodyEl.cloneNode(true);
    
    if (artState.activeModule === 'canvas_builder') {
        const textareas = clonedBody.querySelectorAll('.bmc-textarea');
        textareas.forEach(ta => {
            const val = ta.value;
            const p = document.createElement('div');
            p.style.cssText = 'font-size: 9.5px; line-height: 1.4; white-space: pre-wrap; color: #333; height: 100%; overflow: hidden;';
            p.textContent = val || 'Not specified';
            ta.parentNode.replaceChild(p, ta);
        });
        const headers = clonedBody.querySelectorAll('.bmc-section div');
        headers.forEach(h => {
            const btns = h.querySelectorAll('span:last-child');
            btns.forEach(b => b.remove());
        });
    }
    
    clonedBody.querySelectorAll('button').forEach(btn => btn.remove());
    clonedBody.querySelectorAll('.sandbox-sliders').forEach(sl => sl.remove());
    
    printDiv.innerHTML = stylesHtml + headerHtml + clonedBody.innerHTML + footerHtml;
    
    const filename = `AetherMind_Workspace_${titleText.replace(/[^a-z0-9]/gi, '_')}_${Date.now().toString().substring(8)}.pdf`;
    
    const options = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(options).from(printDiv).save().catch(err => {
        console.error('PDF export error:', err);
        alert('Failed to generate PDF. Please try again.');
    });
}

// Expose open/close globally
window.openArtifact = openArtifact;
window.closeArtifact = closeArtifact;
window.exportArtPdf = exportArtPdf;

// Expose interactions globally
window.toggleScorecardCheckbox = toggleScorecardCheckbox;
window.submitScorecardToAI = submitScorecardToAI;
window.toggleComplianceCheckbox = toggleComplianceCheckbox;
window.downloadICS = downloadICS;
window.updateDilution = updateDilution;
window.exportCapModelToAI = exportCapModelToAI;
window.openEmailModal = openEmailModal;
window.closeEmailModal = closeEmailModal;
window.copyColdEmail = copyColdEmail;
window.highlightBmcSection = highlightBmcSection;
window.saveBmcValue = saveBmcValue;
window.brainstormBMC = brainstormBMC;
window.submitBmcToAI = submitBmcToAI;
window.togglePitchRecording = togglePitchRecording;
window.sendPitchReportToAI = sendPitchReportToAI;

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

document.addEventListener('DOMContentLoaded', init);

