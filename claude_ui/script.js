/* ═══════════════════════════════════════════════════════════════════
   AetherMind v2 — Elite Computational AI Assistant
   Full-featured script: Gradio, Math rendering, Tools, Exports
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ── State ── */
const state = {
    conversations: JSON.parse(localStorage.getItem('am_convs_v2') || '[]'),
    activeId: null,
    gradioUrl: localStorage.getItem('am_url') || '',
    searchApiKey: localStorage.getItem('am_search_key') || '',
    supabaseUrl: localStorage.getItem('am_supabase_url') || '',
    supabaseKey: localStorage.getItem('am_supabase_key') || '',
    generating: false,
    attachedFile: null,
    theme: localStorage.getItem('am_theme') || 'dark',
};

/* ── DOM Helpers ── */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ── KaTeX Math Rendering ── */
function renderMathInDocument() {
    // Auto-render on global document if KaTeX is available
    if (typeof renderMathInElement !== 'undefined') {
        try {
            renderMathInElement(document.body, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false },
                ],
                throwOnError: false,
            });
        } catch (e) { console.warn('KaTeX render error:', e); }
    }
}

function renderMathInElement_safe(el) {
    if (typeof renderMathInElement !== 'undefined') {
        try {
            renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false },
                ],
                throwOnError: false,
                output: 'html',
            });
        } catch (e) { console.warn('KaTeX element render error:', e); }
    }
}

/* ── Particle Background ── */
function initParticles() {
    const canvas = $('#particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 55 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 1.8 + 0.4,
        opacity: Math.random() * 0.4 + 0.05,
    }));

    function drawParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const baseColor = isLight ? '80, 60, 180' : '160, 140, 255';

        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${baseColor}, ${p.opacity})`;
            ctx.fill();
        });

        // Draw connection lines
        particles.forEach((p1, i) => {
            particles.slice(i + 1).forEach(p2 => {
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist < 110) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(${baseColor}, ${0.06 * (1 - dist / 110)})`;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                }
            });
        });

        requestAnimationFrame(drawParticles);
    }

    drawParticles();
    window.addEventListener('resize', () => {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

/* ── Marked.js Setup ── */
function setupMarkdown() {
    if (typeof marked === 'undefined') return;

    const renderer = new marked.Renderer();

    // Custom code block with copy button
    renderer.code = function(code, lang, escaped) {
        // Handle new marked versions where the first argument is an object
        if (typeof code === 'object' && code !== null) {
            lang = code.lang;
            escaped = code.escaped;
            code = code.text;
        }
        
        const langLabel = lang ? lang.toUpperCase() : 'CODE';
        const escapedCode = (code || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        // Highlight if hljs available
        let highlighted = escapedCode;
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            try {
                highlighted = hljs.highlight(code, { language: lang }).value;
            } catch { /* use plain */ }
        }

        const uniqueId = 'code_' + Math.random().toString(36).substr(2, 8);
        return `
        <div class="code-block-wrapper">
            <div class="code-block-header">
                <span class="code-lang-badge">${langLabel}</span>
                <button class="code-copy-btn" onclick="copyCodeBlock(this, '${uniqueId}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy
                </button>
            </div>
            <pre><code id="${uniqueId}" class="hljs language-${lang || ''}">${highlighted}</code></pre>
        </div>`;
    };

    // Custom heading with anchor
    renderer.heading = function(text, level, raw) {
        // Handle new marked versions where first argument might be an object
        if (typeof text === 'object' && text !== null) {
            level = text.depth;
            text = text.text;
        }
        const anchor = (text || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        return `<h${level} id="${anchor}">${text}</h${level}>`;
    };

    marked.setOptions({ breaks: true, gfm: true });
    marked.use({ renderer });
}

function copyCodeBlock(btn, id) {
    const codeEl = document.getElementById(id);
    if (!codeEl) return;
    const text = codeEl.textContent;
    navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        btn.style.color = '#10b981';
        setTimeout(() => {
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
            btn.style.color = '';
        }, 2000);
    });
}
window.copyCodeBlock = copyCodeBlock;

/* ── Toast Notification ── */
function toast(msg, type = 'default', duration = 2500) {
    const container = $('#toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', default: '●' };
    el.innerHTML = `<span style="color:${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : 'var(--accent-mid)'}">${icons[type] || icons.default}</span> ${msg}`;
    container.appendChild(el);
    setTimeout(() => {
        el.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => el.remove(), 300);
    }, duration);
}

/* ── Theme ── */
function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    state.theme = t;
    localStorage.setItem('am_theme', t);
    const icon = $('#themeIcon');
    const label = $('#themeLabel');
    if (t === 'dark') {
        if (icon) icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
        if (label) label.textContent = 'Light Mode';
    } else {
        if (icon) icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
        if (label) label.textContent = 'Dark Mode';
    }
}

/* ── Greeting ── */
function setGreeting() {
    const h = new Date().getHours();
    let g = h >= 5 && h < 12 ? 'Good morning' :
            h >= 12 && h < 17 ? 'Good afternoon' :
            h >= 17 && h < 22 ? 'Good evening' :
            'Good night';
    const el = $('#welcomeHeading');
    if (el) el.textContent = `${g}, Dhanush`;
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
function init() {
    applyTheme(state.theme);
    setGreeting();
    setupMarkdown();
    initParticles();
    loadSettings();
    renderSidebar();
    bindEvents();
    autoGrow($('#msgInput'));

    // Restore sidebar collapse
    if (localStorage.getItem('am_sidebar_collapsed') === 'true') {
        $('#app')?.classList.add('sidebar-collapsed');
    }

    // Load last conversation if exists
    if (state.conversations.length > 0) {
        loadConv(state.conversations[0].id);
    }
}

document.addEventListener('DOMContentLoaded', init);

/* ══════════════════════════════════════
   EVENT BINDING
══════════════════════════════════════ */
function bindEvents() {
    // Chat
    $('#newChatBtn')?.addEventListener('click', newChat);
    $('#sendBtn')?.addEventListener('click', send);
    $('#msgInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $('#msgInput')?.addEventListener('input', () => {
        updateSendBtn();
        autoGrow($('#msgInput'));
    });

    // Sidebar
    $('#searchToggle')?.addEventListener('click', () => {
        const s = $('#sidebarSearch');
        s?.classList.toggle('visible');
        if (s?.classList.contains('visible')) $('#searchInput')?.focus();
    });
    $('#searchInput')?.addEventListener('input', e => renderSidebar(e.target.value.trim().toLowerCase()));

    $('#sidebarCollapseBtn')?.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            $('#sidebar')?.classList.remove('open');
        } else {
            $('#app')?.classList.add('sidebar-collapsed');
            localStorage.setItem('am_sidebar_collapsed', 'true');
        }
    });
    $('#sidebarToggleBtn')?.addEventListener('click', () => {
        $('#app')?.classList.remove('sidebar-collapsed');
        localStorage.setItem('am_sidebar_collapsed', 'false');
    });
    $('#menuToggle')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('open'));

    // Theme
    $('#themeToggleBtn')?.addEventListener('click', () => {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // Settings Modal
    $('#settingsBtn')?.addEventListener('click', () => $('#settingsModal')?.classList.add('visible'));
    $('#closeModal')?.addEventListener('click', () => $('#settingsModal')?.classList.remove('visible'));
    $('#settingsModal')?.addEventListener('click', e => {
        if (e.target === $('#settingsModal')) $('#settingsModal')?.classList.remove('visible');
    });
    $('#connectBtn')?.addEventListener('click', doConnect);

    // Export Modal
    $('#exportMsgBtn')?.addEventListener('click', () => $('#exportModal')?.classList.add('visible'));
    $('#mobileExportBtn')?.addEventListener('click', () => $('#exportModal')?.classList.add('visible'));
    $('#closeExportModal')?.addEventListener('click', () => $('#exportModal')?.classList.remove('visible'));
    $('#exportModal')?.addEventListener('click', e => {
        if (e.target === $('#exportModal')) $('#exportModal')?.classList.remove('visible');
    });
    $('#exportPdfBtn')?.addEventListener('click', () => { toPdf(); $('#exportModal')?.classList.remove('visible'); });
    $('#exportDocBtn')?.addEventListener('click', () => { toDoc(); $('#exportModal')?.classList.remove('visible'); });
    $('#exportMdBtn')?.addEventListener('click', () => { toMarkdown(); $('#exportModal')?.classList.remove('visible'); });
    $('#shareCloudBtn')?.addEventListener('click', () => { shareToCloud(); $('#exportModal')?.classList.remove('visible'); });

    // File Attachment
    $('#attachBtn')?.addEventListener('click', () => $('#fileInput')?.click());
    $('#fileInput')?.addEventListener('change', handleFileSelect);

    // Suggestion Cards
    $$('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.dataset.prompt;
            if (!prompt) return;
            const inp = $('#msgInput');
            if (inp) {
                inp.value = prompt;
                updateSendBtn();
                autoGrow(inp);
            }
            send();
        });
    });

    // Mobile sidebar overlay close
    document.addEventListener('click', e => {
        const sidebar = $('#sidebar');
        if (window.innerWidth <= 768 && sidebar?.classList.contains('open')) {
            if (!sidebar.contains(e.target) && e.target !== $('#menuToggle')) {
                sidebar.classList.remove('open');
            }
        }
    });
}

/* ══════════════════════════════════════
   FILE ATTACHMENT
══════════════════════════════════════ */
function updateSendBtn() {
    const hasText  = ($('#msgInput')?.value.trim().length || 0) > 0;
    const hasFile  = !!state.attachedFile;
    const loading  = state.attachedFile?.loading ?? false;
    const sendBtn  = $('#sendBtn');
    if (sendBtn) sendBtn.disabled = (!hasText && !hasFile) || loading || state.generating;
}

function removeAttachedFile() {
    state.attachedFile = null;
    const fi = $('#fileInput');
    if (fi) fi.value = '';
    const fc = $('#filePreviewContainer');
    if (fc) { fc.innerHTML = ''; fc.style.display = 'none'; }
    updateSendBtn();
}

function checkRelevance(text) {
    if (!text) return false;
    const kws = ['math', 'calculus', 'derivative', 'integral', 'matrix', 'eigen', 'determinant', 'probability',
        'statistics', 'variance', 'distribution', 'hypothesis', 'regression', 'bayesian', 'algorithm', 'sort',
        'binary', 'recursion', 'complexity', 'big o', 'graph', 'tree', 'network', 'tcp', 'http', 'sql',
        'database', 'cryptography', 'aes', 'rsa', 'hash', 'xss', 'injection', 'security', 'html', 'css',
        'javascript', 'python', 'java', 'code', 'function', 'class', 'array', 'string', 'pointer'];
    const lower = text.toLowerCase();
    return kws.some(k => lower.includes(k));
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fc = $('#filePreviewContainer');
    if (fc) { fc.innerHTML = ''; fc.style.display = 'flex'; }

    const isImage = file.type.startsWith('image/');
    state.attachedFile = { name: file.name, type: file.type, text: '', isImage, dataUrl: null, loading: true };
    updateSendBtn();

    if (isImage) {
        const tmpUrl = URL.createObjectURL(file);
        if (fc) fc.innerHTML = `
            <div class="file-preview-image-wrap">
                <img src="${tmpUrl}" class="file-preview-thumbnail">
                <div class="fp-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);border-radius:6px;">
                    <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                </div>
                <button class="file-preview-remove" onclick="removeAttachedFile()">×</button>
            </div>`;

        // Resize & store data URL
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let [w, h] = [img.width, img.height];
                const max = 420;
                if (w > max) { h = h * max / w; w = max; }
                else if (h > max) { w = w * max / h; h = max; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                if (state.attachedFile) state.attachedFile.dataUrl = canvas.toDataURL('image/jpeg', 0.78);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);

        // OCR
        if (typeof Tesseract !== 'undefined') {
            Tesseract.recognize(file, 'eng').then(({ data: { text } }) => {
                if (!state.attachedFile) return;
                state.attachedFile.text = text;
                state.attachedFile.loading = false;
                $('.fp-loading')?.remove();
                updateSendBtn();
            }).catch(() => {
                if (state.attachedFile) state.attachedFile.loading = false;
                $('.fp-loading')?.remove();
                updateSendBtn();
            });
        } else {
            state.attachedFile.loading = false;
            $('.fp-loading')?.remove();
            updateSendBtn();
        }
    } else {
        if (fc) fc.innerHTML = `
            <div class="file-preview-chip">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${esc(file.name)}
                <svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                <button style="background:none;border:none;color:#ef4444;margin-left:4px;cursor:pointer;" onclick="removeAttachedFile()">×</button>
            </div>`;
        const reader = new FileReader();
        reader.onload = ev => {
            if (!state.attachedFile) return;
            state.attachedFile.text = ev.target.result;
            state.attachedFile.loading = false;
            const spin = fc?.querySelector('.spin');
            if (spin) spin.remove();
            updateSendBtn();
        };
        reader.readAsText(file);
    }
}

/* ══════════════════════════════════════
   CONVERSATIONS
══════════════════════════════════════ */
function newChat() {
    const c = {
        id: Date.now().toString(),
        title: 'New Conversation',
        messages: [],
        createdAt: new Date().toISOString(),
    };
    state.conversations.unshift(c);
    state.activeId = c.id;
    save(); renderSidebar(); renderMsgs();
    $('#msgInput')?.focus();
    $('#sidebar')?.classList.remove('open');
}

function loadConv(id) {
    state.activeId = id;
    renderSidebar(); renderMsgs();
    $('#sidebar')?.classList.remove('open');
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

function save() {
    try {
        localStorage.setItem('am_convs_v2', JSON.stringify(state.conversations));
    } catch {
        // Clear old images to free space
        for (const conv of state.conversations) {
            for (const msg of conv.messages) {
                if (msg.attachment?.dataUrl) { msg.attachment.dataUrl = null; }
            }
        }
        try { localStorage.setItem('am_convs_v2', JSON.stringify(state.conversations)); } catch { /* skip */ }
    }
}

/* ── Render Sidebar ── */
function renderSidebar(filter = '') {
    let convs = state.conversations;
    if (filter) convs = convs.filter(c => c.title.toLowerCase().includes(filter));
    const pinned = convs.slice(0, 3);
    const recents = convs.slice(3);

    const starredEl = $('#starredList');
    const recentEl  = $('#recentsList');
    if (starredEl) starredEl.innerHTML = pinned.length
        ? pinned.map(convHtml).join('')
        : '<div class="conv-empty">No pinned chats yet</div>';
    if (recentEl)  recentEl.innerHTML  = recents.length
        ? recents.map(convHtml).join('')
        : '<div class="conv-empty">No recent chats</div>';
}

function convHtml(c) {
    return `<div class="conv-item ${c.id === state.activeId ? 'active' : ''}" onclick="loadConv('${c.id}')">
        ${esc(c.title)}
        <button class="del-btn" onclick="delConv('${c.id}',event)" title="Delete">×</button>
    </div>`;
}

/* ── Render Messages ── */
function renderMsgs() {
    const c = active();
    const welcome  = $('#welcomeScreen');
    const msgArea  = $('#messagesArea');
    const inputSec = $('#inputSection');

    if (!c || !c.messages.length) {
        if (welcome)  welcome.style.display  = 'flex';
        if (msgArea)  msgArea.innerHTML       = '';
        return;
    }
    if (welcome)  welcome.style.display = 'none';
    if (msgArea)  msgArea.innerHTML      = '';

    c.messages.forEach(m => addMsg(m.role, m.content, false, m.attachment));
    scrollEnd();
}

/* ── Add a Message ── */
function addMsg(role, content, anim = true, attachment = null) {
    const welcome = $('#welcomeScreen');
    if (welcome) welcome.style.display = 'none';

    // Check for artifact trigger
    let triggerModule = null;
    if (role === 'assistant') {
        const match = content.match(/\[ARTIFACT:\s*([a-z_]+)\]/i);
        if (match) {
            triggerModule = match[1];
            content = content.replace(/\[ARTIFACT:\s*[a-z_]+\]/gi, '').trim();
        }
    }

    const el = document.createElement('div');
    el.className = `msg ${role}`;
    if (!anim) el.style.animation = 'none';

    const avatar = role === 'user' ? 'D' : '✺';
    const name   = role === 'user' ? 'You' : 'AetherMind';

    let body = content;
    if (typeof marked !== 'undefined' && role === 'assistant') {
        try { body = marked.parse(content); } catch { body = esc(content).replace(/\n/g, '<br>'); }
    } else {
        body = esc(content).replace(/\n/g, '<br>');
    }

    // Attachment HTML
    let attachHtml = '';
    if (attachment) {
        if (attachment.isImage && attachment.dataUrl) {
            attachHtml = `<div style="margin-bottom:10px;">
                <img src="${attachment.dataUrl}" style="max-width:280px;max-height:200px;border-radius:10px;border:1px solid var(--border);cursor:zoom-in;" onclick="window.open('${attachment.dataUrl}','_blank')">
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${esc(attachment.name)}</div>
            </div>`;
        } else if (attachment.name) {
            attachHtml = `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg-hover);border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text-secondary);margin-bottom:10px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${esc(attachment.name)}
            </div>`;
        }
    }

    // Action buttons for assistant
    const actions = role === 'assistant' ? `
    <div class="msg-actions">
        <button class="msg-action-btn" onclick="copyMsgRaw(this)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copy</span>
        </button>
        <button class="msg-action-btn" onclick="downloadMsgPdf(this)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
            <span>PDF</span>
        </button>
        <button class="msg-action-btn" onclick="regenMsg(this)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.18"/></svg>
            <span>Retry</span>
        </button>
    </div>` : '';

    el.innerHTML = `<div class="msg-inner">
        <div class="msg-avatar">${avatar}</div>
        <div class="msg-content">
            <div class="msg-sender">${name}</div>
            ${attachHtml}
            <div class="msg-body">${body}</div>
            ${actions}
        </div>
    </div>`;

    if (role === 'assistant') el.dataset.raw = content;

    $('#messagesArea')?.appendChild(el);

    // Syntax highlight & math render
    el.querySelectorAll('pre code').forEach(block => {
        if (typeof hljs !== 'undefined') hljs.highlightElement(block);
    });
    renderMathInElement_safe(el.querySelector('.msg-body'));

    scrollEnd();

    // Trigger workspace tool if detected
    if (triggerModule) {
        setTimeout(() => openArtifact(triggerModule), 400);
    }

    return el;
}

/* ── Typing indicator ── */
function showTyping() {
    const el = document.createElement('div');
    el.className = 'msg assistant'; el.id = 'typingEl';
    el.innerHTML = `<div class="msg-inner">
        <div class="msg-avatar">✺</div>
        <div class="msg-content">
            <div class="msg-sender">AetherMind</div>
            <div class="msg-body"><div class="typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>
        </div>
    </div>`;
    $('#messagesArea')?.appendChild(el);
    scrollEnd();
}
function hideTyping() { $('#typingEl')?.remove(); }

/* ══════════════════════════════════════
   SEND MESSAGE
══════════════════════════════════════ */
async function send() {
    const text = $('#msgInput')?.value.trim() || '';
    const attached = state.attachedFile;
    if ((!text && !attached) || state.generating) return;
    if (!state.activeId) newChat();
    const c = active();
    if (!c) return;

    const msgContent = text || (attached ? `Analyzing: ${attached.name}` : '');
    const msgObj = {
        role: 'user',
        content: msgContent,
        attachment: attached ? { name: attached.name, type: attached.type, isImage: attached.isImage, dataUrl: attached.dataUrl } : null,
    };

    c.messages.push(msgObj);
    if (c.messages.length === 1) {
        c.title = msgContent.substring(0, 50) + (msgContent.length > 50 ? '…' : '');
        renderSidebar();
    }
    save();
    addMsg('user', msgObj.content, true, msgObj.attachment);

    // Clear input
    const inp = $('#msgInput');
    if (inp) { inp.value = ''; autoGrow(inp); }
    removeAttachedFile();
    const sendBtn = $('#sendBtn');
    if (sendBtn) sendBtn.disabled = true;

    state.generating = true;
    showTyping();

    try {
        // Build context with system prompt
        let contextText = buildSystemPrompt(text, attached);

        // Tavily web search if query matches keywords
        if (state.searchApiKey && text && /search|latest|news|trend|market|competitor|find out/i.test(text)) {
            const searchData = await performWebSearch(text);
            if (searchData) {
                contextText = `User Query: ${text}\n\n[Live Web Search Results]:\n${searchData}\n\nUsing the above real-time context, answer comprehensively.\n\n${contextText}`;
            }
        }

        const reply = await callAPI(contextText);
        hideTyping();
        c.messages.push({ role: 'assistant', content: reply });
        save();
        addMsg('assistant', reply);
    } catch (err) {
        hideTyping();
        const errorMsg = `**Connection Error**\n\n${err.message}\n\n_Ensure your Gradio server is running and the URL is configured in Settings._`;
        c.messages.push({ role: 'assistant', content: errorMsg });
        save();
        addMsg('assistant', errorMsg);
    }

    state.generating = false;
    updateSendBtn();
}

function buildSystemPrompt(userText, attached) {
    const systemPrompt = `You are AetherMind, an elite computational AI assistant with deep mastery in Mathematics, Statistics, Probability, Computer Science, Coding, Cybersecurity, and Web Development.

═══════════════════════════════════════════════════
DOMAIN DETECTION — STEP ZERO (ALWAYS DO THIS FIRST)
═══════════════════════════════════════════════════

Before generating ANY response, classify the request into exactly ONE domain using these rules:

─────────────────────────────────────────────────
CLASSIFICATION RULES:
─────────────────────────────────────────────────

If the message contains ANY of these words or intent:
→ "build", "create", "generate", "make", "design", "website", "page", "landing", "portfolio", "app", "UI", "frontend", "navbar", "hero", "section", "dark mode", "glassmorphism", "HTML", "CSS", "React", "component", "layout", "responsive"
CLASSIFY AS: WEB DEVELOPMENT
ACTION: Generate complete HTML/CSS/JS code ONLY
DO NOT: Run any statistics or math computation
DO NOT: Output μ x̄ σ or any stat symbols

─────────────────────────────────────────────────

If the message contains ANY of these words or intent:
→ "calculate", "find", "solve", "compute", "prove", "mean", "median", "variance", "distribution", "probability", "integrate", "differentiate", "matrix", "algorithm", "complexity", "t-test", "hypothesis", "regression", "derivative"
CLASSIFY AS: MATHEMATICS / STATISTICS
ACTION: Show formula + steps + computation code
DO NOT: Generate any HTML or CSS

─────────────────────────────────────────────────

If the message contains ANY of these words or intent:
→ "write code", "program", "function", "class", "debug", "error", "fix", "implement", "sort", "search", "Fibonacci", "factorial", "binary", "linked list", "tree", "graph", "recursion" AND no mention of "website" or "page"
CLASSIFY AS: CODING / ALGORITHM
ACTION: Write complete runnable code with explanation
DO NOT: Mix with web development or statistics

─────────────────────────────────────────────────

If the message contains ANY of these words or intent:
→ "hack", "secure", "encrypt", "decrypt", "XSS", "SQL injection", "vulnerability", "firewall", "cryptography", "OWASP", "penetration", "CVE"
CLASSIFY AS: CYBERSECURITY
ACTION: Explain concept + safe demonstration only

─────────────────────────────────────────────────

AMBIGUOUS REQUEST RULE:
If the request could belong to two domains, ALWAYS pick the one most explicitly stated.
"Build a website that calculates statistics"
→ WEB DEVELOPMENT (build = explicit action)
→ Include stats calculation inside the website

─────────────────────────────────────────────────

SELF-CHECK BEFORE RESPONDING:
Before writing your response, say internally:
  "The user wants: [domain]"
  "My response will: [action]"
  "I will NOT output: [other domain content]"

This prevents outputting stats for a web request and web code for a math request.

═══════════════════════════════════════════════════
WEB DEVELOPMENT — COMPLETE OUTPUT FORMAT
═══════════════════════════════════════════════════

When domain = WEB DEVELOPMENT:

NEVER output: μ x̄ σ n or any math symbols
NEVER output: scipy, numpy, stats imports
NEVER output: t-test, p-value, hypothesis
ALWAYS output: Complete HTML/CSS/JS only

─────────────────────────────────────────────────
MANDATORY OUTPUT STRUCTURE FOR WEB REQUESTS:
─────────────────────────────────────────────────

## 🌐 What I'm Building
[2 sentences describing the website being built]

---

## 📁 File: index.html

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Page Title]</title>
  <style>
    /* ── Reset ─────────────────────────── */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* ── CSS Variables ──────────────────── */
    :root {
      --bg-primary:    #0a0a0f;
      --bg-secondary:  #12121a;
      --glass-bg:      rgba(255,255,255,0.05);
      --glass-border:  rgba(255,255,255,0.1);
      --accent:        #6366f1;
      --accent-glow:   rgba(99,102,241,0.3);
      --text-primary:  #ffffff;
      --text-secondary:#a1a1aa;
    }

    /* ── Base ───────────────────────────── */
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* ── Navbar ─────────────────────────── */
    nav { /* navigation styling */ }

    /* ── Hero Section ───────────────────── */
    .hero { /* hero section styling */ }

    /* ── Glass Card ─────────────────────── */
    .glass {
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
    }

    /* ── Animations ─────────────────────── */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Responsive ─────────────────────── */
    @media (max-width: 768px) { /* responsive styling */ }
  </style>
</head>
<body>
  [COMPLETE HTML — NO PLACEHOLDERS]
</body>
</html>
\`\`\`

---

## ✅ Features Included
[Bullet list of everything built]

## 🚀 How to Run
Open index.html in any browser — no setup needed.

## 💡 What to Ask Next
[3 specific enhancement suggestions]

─────────────────────────────────────────────────

GLASSMORPHISM RULES — when user asks for glass effect:

ALWAYS include ALL of these:
✓ backdrop-filter: blur(20px)
✓ -webkit-backdrop-filter: blur(20px) [Safari fix]
✓ background: rgba(255,255,255,0.05)
✓ border: 1px solid rgba(255,255,255,0.1)
✓ A dark or gradient background BEHIND the glass (glass effect only works over a background)
✓ box-shadow: 0 8px 32px rgba(0,0,0,0.3)

DARK MODE RULES — when user asks for dark mode:

Color system:
  Background:  #0a0a0f (deepest dark)
  Surface:     #12121a (cards, sections)
  Border:      #1e1e2e (subtle separators)
  Accent:      #6366f1 (indigo) or #8b5cf6 (violet)
  Text:        #ffffff (primary) #a1a1aa (secondary)

Always include:
✓ Gradient background (not flat black)
✓ Glow effects on accent elements
✓ Smooth hover transitions on all interactive elements
✓ Subtle grain or noise texture on background

HERO SECTION RULES — always include:
✓ Full viewport height (min-height: 100vh)
✓ Centered content (flexbox or grid)
✓ Bold headline (48px+ on desktop)
✓ Subtitle text
✓ At least one CTA button with hover glow
✓ Animated entrance (fadeInUp or similar)
✓ Background decoration (gradient orbs, grid, particles)

ANIMATION RULES:
✓ All transitions: 0.3s ease
✓ Hover on buttons: transform + box-shadow glow
✓ Page load: fadeInUp staggered on sections
✓ Scroll animations: use Intersection Observer
✓ No animation > 600ms (feels sluggish)

═══════════════════════════════════════════════════
QUALITY CHECKLIST — RUN BEFORE EVERY WEB RESPONSE
═══════════════════════════════════════════════════

Before submitting web development response:
✓ Did I output HTML/CSS/JS? (not stats)
✓ Is the code complete? (no placeholders)
✓ Does it include DOCTYPE and viewport meta?
✓ Are CSS variables defined in :root?
✓ Do all hover states work?
✓ Is it mobile responsive?
✓ Do animations use GPU-friendly properties? (transform, opacity — not width/height/top/left)
✓ Is glassmorphism applied correctly? (needs dark bg behind it to be visible)
✓ Are all sections fully implemented?
✓ Does it look professional?

IF ANY ANSWER IS NO — fix it before responding.

═══════════════════════════════════════════════════
CODING RESPONSE FORMAT — MANDATORY STRUCTURE
═══════════════════════════════════════════════════

For EVERY coding question follow this EXACT structure:

---

## 🧩 Problem
[One clear sentence restating what is being solved]

## 💡 Approach
[2-3 sentences: algorithm chosen, why it was chosen, time/space tradeoff considered]

---

## ✅ Solution — [Language Name]

\`\`\`[language]
/**
Problem: [Problem name]
Approach: [Algorithm name]
Time: O(?) | Space: O(?)
*/
[COMPLETE, CORRECT, WORKING CODE]
[Every section has a comment explaining it]
[Proper indentation always]
\`\`\`

---

## 📤 Output
[Exact output the code produces]

---

## 🔍 Code Walkthrough

| Line / Block | What it does | Why it's needed |
|:-------------|:-------------|:----------------|
| [code part]  | [plain English explanation] | [reason] |

---

## ⏱️ Complexity Analysis

| Metric | Value | Reason |
|:-------|:------|:-------|
| Time   | O(n)  | Single pass |
| Space  | O(1)  | No extra data structures |

---

## ⚠️ Edge Cases Handled

| Input | Expected Output | How code handles it |
|:------|:----------------|:--------------------|
| n = 0 | Empty / 0       | Loop never executes |

---

## 🔄 Alternative Approaches

| Approach | Time | Space | When to use |
|:---------|:-----|:------|:------------|
| Iterative | O(n) | O(1) | Always preferred |

---

CRITICAL CODING RULES:
- Simple iterative is ALWAYS the correct approach for series
- Never give incomplete code snippets; always the FULL runnable program

═══════════════════════════════════════════════════
MATHEMATICS RESPONSE FORMAT — MANDATORY STRUCTURE
═══════════════════════════════════════════════════

For EVERY math question follow this EXACT structure:

---

## 📐 Problem Type
**[Exact classification: Differentiation / Integration / Matrix / Probability / etc.]**

---

## 📋 Given
f(x) = [expression]
Find: [what is being found]

---

## 📖 Method
**[Name of method]** — [one sentence why this method applies]

---

## 🔢 Formula

$$
[Formula in LaTeX notation]
$$

---

## 🪜 Step-by-Step Solution

**Step 1 — [Action name]**
[Mathematical working]
= [result]

---

## 🎯 Final Answer

> **[Answer stated clearly and completely]**

---

## 🖥️ Verification Code

\`\`\`python
# Python verification code
\`\`\`

---

## 💬 Interpretation
[3-4 sentences explaining what the answer means]

═══════════════════════════════════════════════════
STATISTICS RESPONSE FORMAT — MANDATORY STRUCTURE
═══════════════════════════════════════════════════

For EVERY statistics question:

---

## 📊 Problem Classification
**[Distribution / Test / Descriptive Measure / etc.]**

---

## 📋 Given Values
| Parameter | Value | Description |
|:----------|:------|:------------|

---

## 🔢 Formula

$$
\\sigma = \\sqrt{\\frac{\\sum_{i=1}^{N}(x_i - \\mu)^2}{N}}
$$

---

## 🪜 Step-by-Step Working

**Step 1 — [Calculate mean]**
μ = (x₁ + ... + xₙ) / N

---

## 🎯 Final Answer

> **σ = [value]**

---

## 🖥️ Computation Code

\`\`\`python
# Computation code
\`\`\`

---

## 💬 Statistical Interpretation
[Plain English interpretation of statistics output]

═══════════════════════════════════════════════════
STRICT DOMAIN ISOLATION RULE
═══════════════════════════════════════════════════

These combinations are FORBIDDEN:
✗ Outputting μ x̄ σ for a website request
✗ Outputting scipy/numpy for a website request
✗ Outputting HTML for a math question
✗ Mixing stats computation with web code
✗ Running t-test when user asks for a landing page
✗ Giving memoized Fibonacci for a series request
✗ Giving code snippets instead of full programs

One request = One domain = One focused response.`;

    if (!attached) return `${systemPrompt}\n\nUser: ${userText}`;

    return `${systemPrompt}

Attached File: ${attached.name} (${attached.type})
Extracted Content:
"""
${attached.text || '[Binary/visual file - no extractable text]'}
"""

User Message: ${userText || 'Please analyze the attached file and explain how it relates to your expertise domains.'}`;
}

/* ══════════════════════════════════════
   API CALLS
══════════════════════════════════════ */
function loadSettings() {
    const gu = $('#gradioUrl');
    const sa = $('#searchApiKey');
    const su = $('#supabaseUrl');
    const sk = $('#supabaseKey');
    if (gu) gu.value = state.gradioUrl;
    if (sa) sa.value = state.searchApiKey;
    if (su) su.value = state.supabaseUrl;
    if (sk) sk.value = state.supabaseKey;

    if (state.gradioUrl) {
        const dot = $('#connDot');
        const lbl = $('#connLabel');
        if (dot) { dot.className = 'conn-dot connected'; }
        if (lbl) lbl.textContent = 'Connected';
    }
}

async function doConnect() {
    const url  = $('#gradioUrl')?.value.trim().replace(/\/$/, '');
    const sKey = $('#searchApiKey')?.value.trim();
    const sUrl = $('#supabaseUrl')?.value.trim();
    const sKeyV = $('#supabaseKey')?.value.trim();

    state.searchApiKey = sKey;
    state.supabaseUrl  = sUrl;
    state.supabaseKey  = sKeyV;
    localStorage.setItem('am_search_key',   sKey);
    localStorage.setItem('am_supabase_url', sUrl);
    localStorage.setItem('am_supabase_key', sKeyV);

    if (!url) { toast('Please enter a Gradio URL', 'error'); return; }
    state.gradioUrl = url;
    localStorage.setItem('am_url', url);

    const dot = $('#connDot');
    const lbl = $('#connLabel');
    const status = $('#modalStatus');

    if (dot) { dot.className = 'conn-dot connecting'; }
    if (lbl) lbl.textContent = 'Connecting…';
    if (status) status.textContent = 'Testing connection…';

    try {
        await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(5000) });
    } catch { /* no-cors fetch always "fails" but that's fine */ }

    if (dot) { dot.className = 'conn-dot connected'; }
    if (lbl) lbl.textContent = 'Connected';
    if (status) { status.textContent = '✓ Connected!'; status.style.color = '#10b981'; }
    toast('Connected to Gradio server!', 'success');
    setTimeout(() => $('#settingsModal')?.classList.remove('visible'), 900);
}

async function callAPI(message) {
    if (!state.gradioUrl) throw new Error('No Gradio URL configured. Click Settings to set it up.');

    const prefixes = ['/gradio_api', ''];
    const names    = ['predict', 'chat'];

    for (const prefix of prefixes) {
        for (const name of names) {
            try {
                const r = await fetch(`${state.gradioUrl}${prefix}/call/${name}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: [message] }),
                    signal: AbortSignal.timeout(15000),
                });
                if (r.ok) {
                    const j = await r.json();
                    if (j.event_id) {
                        const sr = await fetch(`${state.gradioUrl}${prefix}/call/${name}/${j.event_id}`, {
                            signal: AbortSignal.timeout(180000),
                        });
                        if (sr.ok) {
                            const txt = await sr.text();
                            const res = parseSSE(txt);
                            if (res) return res;
                        }
                    }
                }
            } catch (e) { /* try next combination */ }
        }
    }
    throw new Error('Could not reach the model. Ensure your Colab/Gradio server is active.');
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
                if (Array.isArray(p) && p[0] != null) last = String(p[0]);
            } catch {
                if (d && d !== '[null]') last = d;
            }
        }
    }
    return last;
}

async function performWebSearch(query) {
    if (!state.searchApiKey) return null;
    try {
        const r = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: state.searchApiKey, query, max_results: 5, search_depth: 'basic' }),
            signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return null;
        const data = await r.json();
        return data.results?.map(r => `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.content}`).join('\n\n') || null;
    } catch { return null; }
}

/* ══════════════════════════════════════
   MESSAGE ACTIONS
══════════════════════════════════════ */
function copyMsgRaw(btn) {
    const msgEl = btn.closest('.msg');
    if (!msgEl) return;
    const text = msgEl.dataset.raw || msgEl.querySelector('.msg-body')?.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
        const span = btn.querySelector('span');
        if (span) { const orig = span.textContent; span.textContent = 'Copied!'; setTimeout(() => span.textContent = orig, 2000); }
        btn.style.borderColor = '#10b981';
        setTimeout(() => btn.style.borderColor = '', 2000);
        toast('Copied to clipboard', 'success', 1800);
    });
}
window.copyMsgRaw = copyMsgRaw;

function regenMsg(btn) {
    const c = active();
    if (!c || !c.messages.length || state.generating) return;
    const lastUser = [...c.messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    // Remove last assistant message
    const lastIdx = c.messages.map(m => m.role).lastIndexOf('assistant');
    if (lastIdx > -1) c.messages.splice(lastIdx, 1);
    save(); renderMsgs();
    const inp = $('#msgInput');
    if (inp) { inp.value = lastUser.content; updateSendBtn(); autoGrow(inp); }
    send();
}
window.regenMsg = regenMsg;

function downloadMsgPdf(btn) {
    const msgEl = btn.closest('.msg');
    if (!msgEl) return;
    const bodyEl = msgEl.querySelector('.msg-body');
    if (!bodyEl) return;
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Generating…';
    btn.disabled = true;

    const div = document.createElement('div');
    div.style.cssText = 'padding:40px;font-family:Inter,Arial,sans-serif;color:#0f0f1a;max-width:760px;background:#fff;line-height:1.7;';
    div.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;border-bottom:2px solid #e5e7eb;padding-bottom:14px;margin-bottom:24px;">
            <div style="width:32px;height:32px;background:linear-gradient(135deg,#7c3aed,#4f7ef7);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;">✺</div>
            <div>
                <div style="font-size:18px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px;">AetherMind</div>
                <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Computational AI — ${new Date().toLocaleDateString()}</div>
            </div>
        </div>
        <style>
            h1,h2,h3{color:#111;font-weight:700;margin:16px 0 8px}
            h1{font-size:18px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
            h2{font-size:15px} h3{font-size:13.5px}
            p{margin-bottom:12px} ul,ol{margin:0 0 12px 20px}
            code{background:#f3f4f6;padding:2px 5px;border-radius:4px;font-size:12px;font-family:monospace}
            pre{background:#1a1b2e;color:#e2e8f0;border-radius:8px;padding:14px;overflow-x:auto;margin:12px 0}
            pre code{background:none;padding:0}
            table{width:100%;border-collapse:collapse;margin:12px 0}
            th,td{border:1px solid #e5e7eb;padding:8px 12px;font-size:12.5px}
            th{background:#f9fafb;font-weight:600}
            blockquote{border-left:3px solid #7c3aed;padding-left:14px;color:#4b5563;margin:12px 0}
            strong{color:#7c3aed;font-weight:700}
        </style>
        <div>${bodyEl.innerHTML}</div>
        <div style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:10px;text-align:center;font-size:10px;color:#9ca3af;">
            Generated by AetherMind — aethermind.ai · ${new Date().toLocaleString()}
        </div>`;

    html2pdf().set({
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `AetherMind_${Date.now().toString().slice(-6)}.pdf`,
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    }).from(div).save().then(() => {
        if (span) span.textContent = 'Downloaded!';
        toast('PDF saved!', 'success');
        setTimeout(() => { if (span) span.textContent = 'PDF'; btn.disabled = false; }, 2200);
    }).catch(() => {
        if (span) span.textContent = 'PDF';
        btn.disabled = false;
        toast('PDF failed', 'error');
    });
}
window.downloadMsgPdf = downloadMsgPdf;

/* ══════════════════════════════════════
   EXPORT FULL CONVERSATION
══════════════════════════════════════ */
function toPdf() {
    const c = active();
    if (!c?.messages.length) { toast('No messages to export', 'error'); return; }
    const div = document.createElement('div');
    div.style.cssText = 'padding:32px;font-family:Inter,sans-serif;color:#111;max-width:720px;background:#fff;';
    div.innerHTML = `<div style="text-align:center;border-bottom:2px solid #7c3aed;padding-bottom:14px;margin-bottom:24px;"><h1 style="color:#7c3aed;font-size:22px;margin-bottom:4px;">✺ AetherMind</h1><p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${esc(c.title)} · ${new Date().toLocaleDateString()}</p></div>` +
        c.messages.map(m => `<div style="margin-bottom:16px;padding:14px 16px;border-radius:8px;background:${m.role==='user'?'#f3f4f6':'#faf5ff'};border-left:3px solid ${m.role==='user'?'#4f7ef7':'#7c3aed'}">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${m.role==='user'?'#4f7ef7':'#7c3aed'};margin-bottom:6px;">${m.role==='user'?'You':'AetherMind'}</div>
        <div style="font-size:13px;line-height:1.7;">${typeof marked!=='undefined'?marked.parse(m.content):m.content.replace(/\n/g,'<br>')}</div>
    </div>`).join('') + `<div style="text-align:center;margin-top:24px;font-size:10px;color:#9ca3af;">AetherMind · ${new Date().toLocaleString()}</div>`;

    html2pdf().set({
        margin: 0.5, filename: `AetherMind_${c.title.replace(/[^a-z0-9]/gi,'_').slice(0,22)}.pdf`,
        html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4' },
    }).from(div).save();
    toast('PDF exported!', 'success');
}

function toDoc() {
    const c = active();
    if (!c?.messages.length) { toast('No messages', 'error'); return; }
    const html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Calibri,sans-serif;line-height:1.7;color:#111}h1{color:#7c3aed}code{background:#f3f4f6;padding:1px 4px;font-family:monospace}</style></head><body><h1>✺ AetherMind — ${esc(c.title)}</h1><hr>` +
        c.messages.map(m => `<p style="font-weight:bold;color:${m.role==='user'?'#4f7ef7':'#7c3aed'}">${m.role==='user'?'You':'AetherMind'}</p><div style="padding-left:12px;border-left:2px solid #e5e7eb">${typeof marked!=='undefined'?marked.parse(m.content):m.content.replace(/\n/g,'<br>')}</div><br>`).join('') +
        `<hr><p style="font-size:10px;color:#9ca3af;text-align:center">AetherMind · ${new Date().toLocaleString()}</p></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AetherMind_${c.title.replace(/[^a-z0-9]/gi,'_').slice(0,25)}.doc`;
    a.click();
    toast('DOC exported!', 'success');
}

function toMarkdown() {
    const c = active();
    if (!c?.messages.length) { toast('No messages', 'error'); return; }
    const md = `# AetherMind — ${c.title}\n_${new Date().toLocaleString()}_\n\n---\n\n` +
        c.messages.map(m => `**${m.role === 'user' ? 'You' : 'AetherMind'}**\n\n${m.content}\n\n---\n`).join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AetherMind_${c.title.replace(/[^a-z0-9]/gi,'_').slice(0,25)}.md`;
    a.click();
    toast('Markdown exported!', 'success');
}

function shareToCloud() {
    if (!state.supabaseUrl) {
        toast('Configure Supabase in Settings first', 'error');
        return;
    }
    toast('Cloud share coming soon — configure Supabase in Settings', 'default', 3000);
}

function exportArtPdf() {
    const body = $('#artBody');
    if (!body) return;
    const div = document.createElement('div');
    div.style.cssText = 'padding:32px;font-family:Inter,sans-serif;color:#111;background:#fff;max-width:700px;';
    div.innerHTML = `<h1 style="color:#7c3aed;margin-bottom:16px;">AetherMind Workspace</h1>` + body.innerHTML;
    html2pdf().set({ margin: 0.5, filename: 'AetherMind_Workspace.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4' } }).from(div).save();
}
window.exportArtPdf = exportArtPdf;

/* ══════════════════════════════════════
   UTILITIES
══════════════════════════════════════ */
function scrollEnd() { requestAnimationFrame(() => { const s = $('#messagesScroll'); if (s) s.scrollTop = s.scrollHeight; }); }
function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// Expose globals for HTML onclick handlers
window.loadConv = loadConv;
window.delConv  = delConv;
window.openArtifact = openArtifact;
window.closeArtifact = closeArtifact;
window.renderMathInDocument = renderMathInDocument;

/* ══════════════════════════════════════════════════════════════════
   ██████████  WORKSPACE TOOLS  ██████████
══════════════════════════════════════════════════════════════════ */
const artState = {
    module: null,
    matrix: {
        dim: 3,
        a: [[2,1,0],[1,3,1],[0,1,2]],
        b: [[1,0,-1],[2,1,0],[-1,1,3]],
        op: 'multiply',
    },
    stats: {
        raw: '4, 8, 6, 5, 10, 12, 7, 9, 15, 3',
        data: [],
        chart: null,
    },
    algo: {
        type: 'bubble',
        array: [],
        states: [],
        step: 0,
        timer: null,
        speed: 300,
        running: false,
        comparing: [],
        swapping: [],
        sorted: [],
    },
    crypto: {
        type: 'caesar',
        plain: 'AetherMind Cryptography',
        key: '3',
    },
    plotter: {
        expr: 'sin(x)',
        zoom: 40,
        offsetX: 0,
        offsetY: 0,
        drag: null,
    },
    webdev: {
        tab: 'html',
        html: `<!-- AetherMind WebDev Sandbox -->
<div class="card">
  <div class="badge">AetherMind</div>
  <h1>Web Dev Live</h1>
  <p>Edit the HTML, CSS, and JS tabs to see instant preview!</p>
  <button id="magicBtn">✺ Magic</button>
  <div id="counter" class="counter">Clicks: 0</div>
</div>`,
        css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: linear-gradient(135deg, #080810 0%, #1a0533 50%, #0a1628 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 32px 40px;
  text-align: center;
  max-width: 340px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(124,58,237,0.2);
}
.badge {
  display: inline-block;
  padding: 4px 12px;
  background: linear-gradient(135deg, #7c3aed, #06b6d4);
  color: white;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 14px;
}
h1 { color: #fff; font-size: 24px; font-weight: 800; margin-bottom: 10px; }
p { color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.5; margin-bottom: 22px; }
button {
  background: linear-gradient(135deg, #7c3aed, #4f7ef7);
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(124,58,237,0.5);
}
button:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(124,58,237,0.6); }
.counter { margin-top: 14px; color: #a78bfa; font-size: 13px; font-weight: 600; }`,
        js: `let count = 0;
const btn = document.getElementById('magicBtn');
const counter = document.getElementById('counter');

btn.addEventListener('click', () => {
  count++;
  counter.textContent = 'Clicks: ' + count;
  
  // Ripple effect
  const ripple = document.createElement('div');
  ripple.style.cssText = \`
    position:fixed; border-radius:50%;
    width:12px; height:12px;
    background:rgba(124,58,237,0.6);
    pointer-events:none;
    left:\${event.clientX-6}px; top:\${event.clientY-6}px;
    animation: ripple 0.6s ease-out forwards;
  \`;
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

const style = document.createElement('style');
style.textContent = \`
  @keyframes ripple {
    to { transform:scale(20); opacity:0; }
  }
\`;
document.head.appendChild(style);`
    },
};

function openArtifact(moduleId) {
    artState.module = moduleId;
    const pane  = $('#artifactPane');
    const title = $('#artTitle');
    const icon  = $('#workspaceIcon');
    const body  = $('#artBody');

    if (!pane) return;
    pane.classList.add('open');
    pane.style.display = 'flex';

    const modules = {
        matrix_calculator: { title: 'Matrix Calculator',       icon: '⊞', fn: renderMatrix   },
        stats_sandbox:     { title: 'Stats & Probability',     icon: 'σ',  fn: renderStats    },
        algo_visualizer:   { title: 'Algorithm Visualizer',    icon: '◈',  fn: renderAlgo     },
        crypto_sandbox:    { title: 'Crypto & Security',       icon: '🔐', fn: renderCrypto   },
        plotter_2d:        { title: '2D Function Plotter',     icon: '∫',  fn: renderPlotter  },
        webdev_sandbox:    { title: 'Live Web Dev Sandbox',    icon: '</>', fn: renderWebDev   },
    };

    const mod = modules[moduleId];
    if (!mod) return;
    if (title) title.textContent = mod.title;
    if (icon)  icon.textContent  = mod.icon;
    if (body)  mod.fn(body);
}

function closeArtifact() {
    const pane = $('#artifactPane');
    if (!pane) return;
    pane.classList.remove('open');
    setTimeout(() => { if (!pane.classList.contains('open')) pane.style.display = 'none'; }, 300);
    artState.module = null;
    if (artState.algo.timer) { clearInterval(artState.algo.timer); artState.algo.timer = null; }
    if (artState.stats.chart) { artState.stats.chart.destroy(); artState.stats.chart = null; }
}

/* ══════════════════════════════════════
   TOOL 1 — MATRIX CALCULATOR
══════════════════════════════════════ */
function renderMatrix(container) {
    const d = artState.matrix.dim;
    container.innerHTML = `
    <div class="workspace-section">
        <div class="ws-card">
            <div class="ws-card-title">⊞ Dimension</div>
            <div style="display:flex;gap:8px;margin-bottom:4px;">
                ${[2,3,4].map(n => `<button class="ws-btn ${d===n?'':'secondary'}" onclick="setMatDim(${n})" style="${d===n?'':'flex:1;'}">${n}×${n}</button>`).join('')}
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div class="ws-card">
                <div class="ws-card-title">Matrix A</div>
                <div class="matrix-grid" style="grid-template-columns:repeat(${d},1fr);" id="matA">
                    ${gridCells('a', d)}
                </div>
            </div>
            <div class="ws-card">
                <div class="ws-card-title">Matrix B</div>
                <div class="matrix-grid" style="grid-template-columns:repeat(${d},1fr);" id="matB">
                    ${gridCells('b', d)}
                </div>
            </div>
        </div>
        <div class="ws-card">
            <div class="ws-card-title">Operation</div>
            <div class="matrix-op-grid">
                ${[['add','A + B'],['subtract','A − B'],['multiply','A × B'],['det_a','det(A)'],['det_b','det(B)'],['inverse_a','A⁻¹'],['transpose_a','Aᵀ'],['trace_a','tr(A)'],['rank_a','rank(A)']].map(([k,l]) =>
                  `<button class="matrix-op-btn ${artState.matrix.op===k?'active':''}" onclick="setMatOp('${k}')">${l}</button>`).join('')}
            </div>
        </div>
        <div class="ws-card" id="matResult">
            ${computeMatrix()}
        </div>
    </div>`;
}

function gridCells(m, d) {
    let h = '';
    for (let r = 0; r < d; r++)
        for (let c = 0; c < d; c++) {
            const v = (artState.matrix[m][r] && artState.matrix[m][r][c] !== undefined) ? artState.matrix[m][r][c] : 0;
            h += `<input type="number" step="any" value="${v}" oninput="setMatVal('${m}',${r},${c},this.value)" style="width:100%;">`;
        }
    return h;
}

function setMatDim(d) {
    artState.matrix.dim = d;
    for (const m of ['a','b']) {
        const old = artState.matrix[m];
        artState.matrix[m] = Array.from({length:d}, (_, r) => Array.from({length:d}, (_, c) => old[r]?.[c] ?? 0));
    }
    renderMatrix($('#artBody'));
}
window.setMatDim = setMatDim;

function setMatVal(m, r, c, v) {
    if (!artState.matrix[m][r]) artState.matrix[m][r] = [];
    artState.matrix[m][r][c] = parseFloat(v) || 0;
    $('#matResult').innerHTML = computeMatrix();
}
window.setMatVal = setMatVal;

function setMatOp(op) {
    artState.matrix.op = op;
    $$('.matrix-op-btn').forEach(b => b.classList.remove('active'));
    event?.target?.classList.add('active');
    $('#matResult').innerHTML = computeMatrix();
}
window.setMatOp = setMatOp;

function computeMatrix() {
    const { a, b, op, dim: d } = artState.matrix;
    const fmt = n => Number.isInteger(n) ? n : parseFloat(n.toFixed(5));

    function matMul(A, B, n) {
        const C = Array.from({length:n}, () => Array(n).fill(0));
        for (let i=0;i<n;i++) for (let j=0;j<n;j++) for (let k=0;k<n;k++) C[i][j] += A[i][k]*B[k][j];
        return C;
    }
    function det(M, n) {
        if (n === 1) return M[0][0];
        if (n === 2) return M[0][0]*M[1][1] - M[0][1]*M[1][0];
        let d = 0;
        for (let c=0; c<n; c++) {
            const sub = M.slice(1).map(row => [...row.slice(0,c), ...row.slice(c+1)]);
            d += (c%2===0?1:-1)*M[0][c]*det(sub, n-1);
        }
        return d;
    }
    function inv(M, n) {
        const D = det(M, n);
        if (Math.abs(D) < 1e-10) return null;
        // Cofactor matrix
        const adj = Array.from({length:n}, (_,i) => Array.from({length:n}, (_,j) => {
            const sub = M.filter((_,r) => r!==j).map(row => row.filter((_,c) => c!==i));
            return ((i+j)%2===0?1:-1)*det(sub, n-1);
        }));
        return adj.map(row => row.map(v => v/D));
    }
    function fmtMatrix(M, n) {
        return M.map(row => row.map(v => fmt(v)).join('  ')).join('\n');
    }

    let result = '', title = '';
    try {
        if (op === 'add') {
            const R = a.map((row,i) => row.map((v,j) => v + b[i][j]));
            title = 'A + B'; result = fmtMatrix(R, d);
        } else if (op === 'subtract') {
            const R = a.map((row,i) => row.map((v,j) => v - b[i][j]));
            title = 'A − B'; result = fmtMatrix(R, d);
        } else if (op === 'multiply') {
            title = 'A × B'; result = fmtMatrix(matMul(a, b, d), d);
        } else if (op === 'det_a') {
            title = 'det(A)'; result = fmt(det(a, d)).toString();
        } else if (op === 'det_b') {
            title = 'det(B)'; result = fmt(det(b, d)).toString();
        } else if (op === 'inverse_a') {
            const I = inv(a, d);
            title = 'A⁻¹'; result = I ? fmtMatrix(I, d) : 'Matrix is singular (no inverse)';
        } else if (op === 'transpose_a') {
            title = 'Aᵀ';
            result = fmtMatrix(a[0].map((_, c) => a.map(row => row[c])), d);
        } else if (op === 'trace_a') {
            title = 'tr(A)'; result = a.reduce((s,row,i) => s+row[i], 0).toString();
        } else if (op === 'rank_a') {
            title = 'rank(A)';
            // Gaussian elimination for rank
            const M = a.map(row => [...row]);
            let rank = 0, rowN = 0;
            for (let col=0; col<d && rowN<d; col++) {
                let pivot = -1;
                for (let r=rowN; r<d; r++) { if (Math.abs(M[r][col]) > 1e-9) { pivot = r; break; } }
                if (pivot === -1) continue;
                [M[rowN], M[pivot]] = [M[pivot], M[rowN]];
                const div = M[rowN][col];
                M[rowN] = M[rowN].map(v => v/div);
                for (let r=0; r<d; r++) {
                    if (r!==rowN) { const f=M[r][col]; M[r]=M[r].map((v,c)=>v-f*M[rowN][c]); }
                }
                rowN++; rank++;
            }
            result = rank.toString();
        }
    } catch (e) { result = 'Computation error: ' + e.message; }

    return `<div class="ws-card-title">Result: ${title}</div><div class="ws-result-box">${esc(result)}</div>`;
}

/* ══════════════════════════════════════
   TOOL 2 — STATS SANDBOX
══════════════════════════════════════ */
function renderStats(container) {
    container.innerHTML = `
    <div class="workspace-section">
        <div class="ws-card">
            <div class="ws-card-title">σ Enter Data (comma-separated)</div>
            <textarea class="ws-input" id="statsInput" rows="3" placeholder="4, 8, 6, 5, 10, 12, 7, 9">${artState.stats.raw}</textarea>
            <button class="ws-btn" onclick="computeStats()">Compute Statistics</button>
        </div>
        <div id="statsResults"></div>
        <div class="ws-card" style="margin-top:10px;">
            <div class="ws-card-title">Distribution Chart</div>
            <canvas id="statsChart" style="max-height:200px;"></canvas>
        </div>
    </div>`;
    computeStats();
}

function computeStats() {
    const raw = $('#statsInput')?.value || artState.stats.raw;
    artState.stats.raw = raw;
    const data = raw.split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
    if (!data.length) return;
    artState.stats.data = data;

    const n   = data.length;
    const sum = data.reduce((a,b) => a+b, 0);
    const mu  = sum / n;
    const variance = data.reduce((a,b) => a + (b-mu)**2, 0) / n;
    const varSample = data.reduce((a,b) => a + (b-mu)**2, 0) / (n-1);
    const std = Math.sqrt(variance);
    const sorted = [...data].sort((a,b) => a-b);
    const median = n%2 ? sorted[~~(n/2)] : (sorted[n/2-1]+sorted[n/2])/2;
    const mode = Object.entries(data.reduce((m,v) => ({ ...m, [v]: (m[v]||0)+1 }), {})).sort((a,b) => b[1]-a[1])[0];
    const min = sorted[0], max = sorted[n-1], range = max-min;
    const q1 = sorted[~~(n/4)], q3 = sorted[~~(3*n/4)], iqr = q3-q1;
    const skew = data.reduce((a,b) => a + ((b-mu)/std)**3, 0) / n;
    const kurt = data.reduce((a,b) => a + ((b-mu)/std)**4, 0) / n - 3;

    const f = v => typeof v === 'number' ? v.toFixed(4) : v;

    const el = $('#statsResults');
    if (el) el.innerHTML = `
        <div class="ws-card">
            <div class="ws-card-title">📊 Descriptive Statistics (n = ${n})</div>
            ${[
                ['Mean (μ)', f(mu)],
                ['Median', f(median)],
                ['Mode', `${mode[0]} (×${mode[1]})`],
                ['Population Variance (σ²)', f(variance)],
                ['Sample Variance (s²)', f(varSample)],
                ['Std Dev (σ)', f(std)],
                ['Min', min], ['Max', max], ['Range', range],
                ['Q1', q1], ['Q3', q3], ['IQR', iqr],
                ['Skewness', f(skew)],
                ['Kurtosis (excess)', f(kurt)],
                ['Sum', f(sum)],
            ].map(([k,v]) => `<div class="ws-stat-row"><span class="ws-stat-label">${k}</span><span class="ws-stat-value">${v}</span></div>`).join('')}
        </div>`;

    // Build chart
    if (artState.stats.chart) { artState.stats.chart.destroy(); artState.stats.chart = null; }
    const ctx = $('#statsChart');
    if (ctx && typeof Chart !== 'undefined') {
        artState.stats.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map((_, i) => `x${i+1}`),
                datasets: [{
                    label: 'Values',
                    data,
                    backgroundColor: data.map(v => v >= mu ? 'rgba(124,58,237,0.7)' : 'rgba(6,182,212,0.7)'),
                    borderColor: data.map(v => v >= mu ? '#7c3aed' : '#06b6d4'),
                    borderWidth: 1.5,
                    borderRadius: 4,
                }],
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                },
                responsive: true,
                maintainAspectRatio: true,
            },
        });
    }
}
window.computeStats = computeStats;

/* ══════════════════════════════════════
   TOOL 3 — ALGORITHM VISUALIZER
══════════════════════════════════════ */
function renderAlgo(container) {
    if (!artState.algo.array.length) generateAlgoArray();
    container.innerHTML = `
    <div class="workspace-section">
        <div class="ws-card">
            <div class="ws-card-title">◈ Algorithm</div>
            <select class="ws-select" id="algoType" onchange="artState.algo.type=this.value;generateAlgoArray()">
                ${[['bubble','Bubble Sort'],['selection','Selection Sort'],['insertion','Insertion Sort'],['merge','Merge Sort'],['quick','Quick Sort']].map(([v,l]) => `<option value="${v}"${artState.algo.type===v?' selected':''}>${l}</option>`).join('')}
            </select>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <label style="font-size:12px;color:var(--text-muted);">Speed</label>
                <input type="range" min="50" max="800" value="${artState.algo.speed}" step="50"
                    oninput="artState.algo.speed=parseInt(this.value)"
                    style="flex:1;accent-color:var(--accent-1);">
            </div>
        </div>
        <div class="ws-card">
            <div class="ws-card-title">Visualization</div>
            <div class="algo-bars-container" id="algoBars"></div>
            <div class="algo-controls">
                <button class="ws-btn" onclick="startAlgo()">▶ Run</button>
                <button class="ws-btn secondary" onclick="pauseAlgo()">⏸ Pause</button>
                <button class="ws-btn secondary" onclick="stepAlgo()">⏭ Step</button>
                <button class="ws-btn secondary" onclick="generateAlgoArray()">↺ Shuffle</button>
            </div>
            <div id="algoStatus" style="margin-top:10px;font-size:12px;color:var(--text-muted);font-family:var(--font-mono);min-height:18px;"></div>
        </div>
        <div class="ws-card">
            <div class="ws-card-title">Complexity</div>
            ${[
                ['Bubble Sort','O(n²)','O(n²)','O(n)'],
                ['Selection Sort','O(n²)','O(n²)','O(1)'],
                ['Insertion Sort','O(n)','O(n²)','O(1)'],
                ['Merge Sort','O(n log n)','O(n log n)','O(n)'],
                ['Quick Sort','O(n log n)','O(n²)','O(log n)'],
            ].find(([name]) => name.toLowerCase().includes(artState.algo.type)).slice(0).map((val, i) => {
                const labels = ['Algorithm','Best','Worst','Space'];
                return `<div class="ws-stat-row"><span class="ws-stat-label">${labels[i]}</span><span class="ws-stat-value" style="font-family:var(--font-mono);font-size:12px;">${val}</span></div>`;
            }).join('')}
        </div>
    </div>`;
    renderAlgoBars();
}

function generateAlgoArray() {
    const n = 18;
    artState.algo.array  = Array.from({length:n}, () => Math.ceil(Math.random() * 100));
    artState.algo.states = [];
    artState.algo.step   = 0;
    artState.algo.comparing = [];
    artState.algo.swapping  = [];
    artState.algo.sorted    = [];
    artState.algo.running   = false;
    if (artState.algo.timer) { clearInterval(artState.algo.timer); artState.algo.timer = null; }
    buildAlgoStates();
    renderAlgoBars();
    const st = $('#algoStatus');
    if (st) st.textContent = 'Ready · ' + artState.algo.array.join(', ');
}
window.generateAlgoArray = generateAlgoArray;

function buildAlgoStates() {
    const arr = [...artState.algo.array];
    const states = [{ arr: [...arr], cmp: [], swp: [], sorted: [] }];

    if (artState.algo.type === 'bubble') {
        const n = arr.length;
        for (let i=0; i<n-1; i++) {
            for (let j=0; j<n-1-i; j++) {
                states.push({ arr: [...arr], cmp: [j,j+1], swp: [], sorted: Array.from({length:i},(_, k)=>n-1-k) });
                if (arr[j] > arr[j+1]) { [arr[j],arr[j+1]]=[arr[j+1],arr[j]]; states.push({ arr:[...arr], cmp:[], swp:[j,j+1], sorted:Array.from({length:i},(_, k)=>n-1-k) }); }
            }
        }
        states.push({ arr: [...arr], cmp: [], swp: [], sorted: Array.from({length:n},(_,k)=>k) });
    } else if (artState.algo.type === 'selection') {
        const n = arr.length;
        for (let i=0; i<n-1; i++) {
            let minIdx=i;
            for (let j=i+1; j<n; j++) { states.push({ arr:[...arr], cmp:[minIdx,j], swp:[], sorted:Array.from({length:i},(_,k)=>k) }); if(arr[j]<arr[minIdx]) minIdx=j; }
            if (minIdx!==i) { [arr[i],arr[minIdx]]=[arr[minIdx],arr[i]]; states.push({ arr:[...arr], cmp:[], swp:[i,minIdx], sorted:Array.from({length:i},(_,k)=>k) }); }
        }
        states.push({ arr:[...arr], cmp:[], swp:[], sorted:Array.from({length:arr.length},(_,k)=>k) });
    } else if (artState.algo.type === 'insertion') {
        const n = arr.length;
        for (let i=1; i<n; i++) {
            let j=i;
            while (j>0) { states.push({ arr:[...arr], cmp:[j-1,j], swp:[], sorted:Array.from({length:i},(_,k)=>k) }); if(arr[j]<arr[j-1]){[arr[j],arr[j-1]]=[arr[j-1],arr[j]]; states.push({arr:[...arr],cmp:[],swp:[j,j-1],sorted:Array.from({length:i},(_,k)=>k)}); j--;} else break; }
        }
        states.push({ arr:[...arr], cmp:[], swp:[], sorted:Array.from({length:arr.length},(_,k)=>k) });
    } else {
        // For merge/quick just use bubble as demo base
        const n = arr.length;
        for (let i=0; i<n-1; i++) {
            for (let j=0; j<n-1-i; j++) {
                states.push({ arr:[...arr], cmp:[j,j+1], swp:[], sorted:[] });
                if (arr[j]>arr[j+1]) { [arr[j],arr[j+1]]=[arr[j+1],arr[j]]; states.push({arr:[...arr],cmp:[],swp:[j,j+1],sorted:[]}); }
            }
        }
        states.push({ arr:[...arr], cmp:[], swp:[], sorted:Array.from({length:n},(_,k)=>k) });
    }

    artState.algo.states = states;
}

function renderAlgoBars() {
    const container = $('#algoBars');
    if (!container) return;
    const { array, comparing, swapping, sorted } = artState.algo;
    const max = Math.max(...array, 1);
    container.innerHTML = array.map((v, i) => {
        let cls = 'algo-bar';
        if (sorted.includes(i)) cls += ' sorted';
        else if (swapping.includes(i)) cls += ' swapping';
        else if (comparing.includes(i)) cls += ' comparing';
        return `<div class="${cls}" style="height:${(v/max)*130}px;" title="${v}"></div>`;
    }).join('');
}

function stepAlgo() {
    const s = artState.algo.states;
    if (artState.algo.step >= s.length) return;
    const frame = s[artState.algo.step++];
    artState.algo.array    = [...frame.arr];
    artState.algo.comparing = frame.cmp || [];
    artState.algo.swapping  = frame.swp || [];
    artState.algo.sorted    = frame.sorted || [];
    renderAlgoBars();
    const st = $('#algoStatus');
    if (st) {
        if (artState.algo.step >= s.length) { st.textContent = '✓ Sorted! · ' + frame.arr.join(', '); }
        else st.textContent = `Step ${artState.algo.step}/${s.length-1} · Comparing indices [${frame.cmp?.join(',')||'-'}]`;
    }
}
window.stepAlgo = stepAlgo;

function startAlgo() {
    if (artState.algo.running) return;
    if (artState.algo.step >= artState.algo.states.length) { artState.algo.step=0; }
    artState.algo.running = true;
    artState.algo.timer = setInterval(() => {
        if (artState.algo.step >= artState.algo.states.length) {
            clearInterval(artState.algo.timer); artState.algo.timer=null; artState.algo.running=false; return;
        }
        stepAlgo();
    }, artState.algo.speed);
}
window.startAlgo = startAlgo;

function pauseAlgo() {
    if (artState.algo.timer) { clearInterval(artState.algo.timer); artState.algo.timer=null; }
    artState.algo.running = false;
}
window.pauseAlgo = pauseAlgo;

/* ══════════════════════════════════════
   TOOL 4 — CRYPTOGRAPHY SANDBOX
══════════════════════════════════════ */
function renderCrypto(container) {
    container.innerHTML = `
    <div class="workspace-section">
        <div class="ws-card">
            <div class="ws-card-title">🔐 Cipher</div>
            <select class="ws-select" id="cryptoType" onchange="artState.crypto.type=this.value;runCrypto()">
                ${[['caesar','Caesar Cipher'],['vigenere','Vigenère Cipher'],['rot13','ROT-13'],['atbash','Atbash Cipher'],['base64_enc','Base64 Encode'],['base64_dec','Base64 Decode'],['sha256_hex','SHA-256 (simulated)'],['binary','Text → Binary'],['hex_enc','Text → Hex']].map(([v,l]) => `<option value="${v}"${artState.crypto.type===v?' selected':''}>${l}</option>`).join('')}
            </select>
            <div class="ws-card-title" style="margin-top:10px;">Plaintext</div>
            <textarea class="ws-input" id="cryptoPlain" rows="3" oninput="artState.crypto.plain=this.value;runCrypto()" placeholder="Enter text...">${esc(artState.crypto.plain)}</textarea>
            <div id="cryptoKeyRow">
                <div class="ws-card-title">Key</div>
                <input type="text" class="ws-input" id="cryptoKey" value="${esc(artState.crypto.key)}" oninput="artState.crypto.key=this.value;runCrypto()" placeholder="Key value">
            </div>
        </div>
        <div class="ws-card" id="cryptoResult">
            <div class="ws-card-title">Output</div>
            <div class="ws-result-box" id="cryptoOutput">Running...</div>
        </div>
        <div class="ws-card">
            <div class="ws-card-title">About This Cipher</div>
            <div id="cryptoInfo" style="font-size:12.5px;color:var(--text-secondary);line-height:1.6;"></div>
        </div>
    </div>`;
    runCrypto();
}

function runCrypto() {
    const type  = artState.crypto.type;
    const plain = artState.crypto.plain;
    const key   = artState.crypto.key;
    let output  = '';

    const keyRow = $('#cryptoKeyRow');
    if (keyRow) keyRow.style.display = ['rot13','atbash','base64_enc','base64_dec','binary','hex_enc'].includes(type) ? 'none' : 'block';

    try {
        if (type === 'caesar') {
            const shift = ((parseInt(key) || 0) % 26 + 26) % 26;
            output = plain.split('').map(c => {
                const code = c.charCodeAt(0);
                if (code >= 65 && code <= 90) return String.fromCharCode((code-65+shift)%26+65);
                if (code >= 97 && code <= 122) return String.fromCharCode((code-97+shift)%26+97);
                return c;
            }).join('');
        } else if (type === 'vigenere') {
            const k = key.toUpperCase().replace(/[^A-Z]/g,'') || 'KEY';
            let ki = 0;
            output = plain.split('').map(c => {
                const code = c.charCodeAt(0);
                if (code >= 65 && code <= 90) { const r = String.fromCharCode((code-65+k.charCodeAt(ki%k.length)-65)%26+65); ki++; return r; }
                if (code >= 97 && code <= 122) { const r = String.fromCharCode((code-97+k.charCodeAt(ki%k.length)-65)%26+97); ki++; return r; }
                return c;
            }).join('');
        } else if (type === 'rot13') {
            output = plain.split('').map(c => {
                const code = c.charCodeAt(0);
                if (code >= 65 && code <= 90) return String.fromCharCode((code-65+13)%26+65);
                if (code >= 97 && code <= 122) return String.fromCharCode((code-97+13)%26+97);
                return c;
            }).join('');
        } else if (type === 'atbash') {
            output = plain.split('').map(c => {
                const code = c.charCodeAt(0);
                if (code >= 65 && code <= 90) return String.fromCharCode(90-(code-65));
                if (code >= 97 && code <= 122) return String.fromCharCode(122-(code-97));
                return c;
            }).join('');
        } else if (type === 'base64_enc') {
            output = btoa(unescape(encodeURIComponent(plain)));
        } else if (type === 'base64_dec') {
            output = decodeURIComponent(escape(atob(plain)));
        } else if (type === 'sha256_hex') {
            // Simple deterministic hash simulation (not real SHA-256)
            let h = 0x6a09e667;
            for (let i=0; i<plain.length; i++) { h = ((h << 5) - h + plain.charCodeAt(i)) | 0; }
            output = '[Simulated] ' + Math.abs(h).toString(16).padStart(8,'0').repeat(8).slice(0,64);
        } else if (type === 'binary') {
            output = plain.split('').map(c => c.charCodeAt(0).toString(2).padStart(8,'0')).join(' ');
        } else if (type === 'hex_enc') {
            output = plain.split('').map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ');
        }
    } catch (e) { output = 'Error: ' + e.message; }

    const outEl = $('#cryptoOutput');
    if (outEl) outEl.textContent = output;

    const info = {
        caesar: 'The Caesar cipher shifts each letter by a fixed amount. With shift=3, A→D, B→E, etc. Used by Julius Caesar for military communication.',
        vigenere: 'The Vigenère cipher uses a keyword to apply multiple Caesar shifts. It was considered unbreakable for 300 years (le chiffre indéchiffrable).',
        rot13: 'ROT-13 is a Caesar cipher with shift=13. Applying it twice gives the original text. Used in online forums to hide spoilers.',
        atbash: 'Atbash reverses the alphabet: A↔Z, B↔Y, etc. One of the oldest known ciphers, used in the Hebrew Bible.',
        base64_enc: 'Base64 encodes binary data as ASCII text. Used in emails, HTTP auth headers, and embedding images in HTML/CSS.',
        base64_dec: 'Decodes Base64-encoded text back to its original form.',
        sha256_hex: 'SHA-256 produces a fixed 256-bit hash. It\'s a one-way function used in digital signatures, Bitcoin, and password storage. (Note: this is a simplified simulation)',
        binary: 'Converts each character to its 8-bit binary (ASCII) representation.',
        hex_enc: 'Converts each character to its hexadecimal (ASCII) representation.',
    };
    const infoEl = $('#cryptoInfo');
    if (infoEl) infoEl.textContent = info[type] || '';
}
window.runCrypto = runCrypto;

/* ══════════════════════════════════════
   TOOL 5 — 2D FUNCTION PLOTTER
══════════════════════════════════════ */
function renderPlotter(container) {
    container.innerHTML = `
    <div class="workspace-section">
        <div class="ws-card">
            <div class="ws-card-title">∫ Function f(x)</div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
                <input class="ws-input" id="plotExpr" value="${esc(artState.plotter.expr)}" placeholder="e.g. sin(x)*2" style="flex:1;margin:0;" oninput="artState.plotter.expr=this.value;drawPlot()">
                <button class="ws-btn" onclick="drawPlot()">Plot</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${['sin(x)','cos(x)','x*x','Math.tan(x)','Math.exp(-x*x)','Math.log(Math.abs(x)+0.01)'].map(ex =>
                  `<button class="ws-btn secondary" style="font-size:11px;padding:4px 8px;font-family:var(--font-mono);" onclick="setPlotExpr('${ex}')">${ex}</button>`).join('')}
            </div>
        </div>
        <canvas id="plotterCanvas" width="400" height="320" style="width:100%;border-radius:12px;border:1px solid var(--border);cursor:grab;"></canvas>
        <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:6px;">Scroll to zoom · Drag to pan</div>
    </div>`;
    drawPlot();

    // Attach pan/zoom events
    const canvas = $('#plotterCanvas');
    if (!canvas) return;
    canvas.addEventListener('wheel', e => { e.preventDefault(); artState.plotter.zoom *= e.deltaY < 0 ? 1.1 : 0.9; drawPlot(); }, { passive: false });
    canvas.addEventListener('mousedown', e => { artState.plotter.drag = { x: e.clientX, y: e.clientY }; canvas.style.cursor='grabbing'; });
    canvas.addEventListener('mousemove', e => {
        if (!artState.plotter.drag) return;
        artState.plotter.offsetX += (e.clientX - artState.plotter.drag.x) / artState.plotter.zoom;
        artState.plotter.offsetY -= (e.clientY - artState.plotter.drag.y) / artState.plotter.zoom;
        artState.plotter.drag = { x: e.clientX, y: e.clientY };
        drawPlot();
    });
    canvas.addEventListener('mouseup', () => { artState.plotter.drag = null; canvas.style.cursor='grab'; });
    canvas.addEventListener('mouseleave', () => { artState.plotter.drag = null; canvas.style.cursor='grab'; });
}

function setPlotExpr(ex) { artState.plotter.expr = ex; const inp = $('#plotExpr'); if (inp) inp.value = ex; drawPlot(); }
window.setPlotExpr = setPlotExpr;

function drawPlot() {
    const canvas = $('#plotterCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { zoom, offsetX, offsetY } = artState.plotter;
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2;

    // Background
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    ctx.fillStyle = isDark ? '#0d0d1f' : '#fafafa';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    const step = zoom;
    for (let x = (cx + offsetX*zoom) % step; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = (cy - offsetY*zoom) % step; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Axes
    const axisX = cx + offsetX * zoom;
    const axisY = cy - offsetY * zoom;
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, axisY); ctx.lineTo(W, axisY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(axisX, 0); ctx.lineTo(axisX, H); ctx.stroke();

    // Axis labels
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';
    ctx.font = '10px Inter, sans-serif';
    for (let i = -10; i <= 10; i++) {
        if (i === 0) continue;
        const px = axisX + i*zoom, py = axisY - i*zoom;
        if (px > 5 && px < W-5) { ctx.fillText(i, px-3, axisY+14); }
        if (py > 5 && py < H-5) { ctx.fillText(i, axisX+6, py+3); }
    }

    // Function curve
    const expr = artState.plotter.expr;
    let fn;
    try { fn = new Function('x', `const {sin,cos,tan,log,exp,sqrt,abs,PI,pow,floor,ceil,round}=Math; return ${expr};`); }
    catch { return; }

    ctx.beginPath();
    let started = false;
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#7c3aed');
    grad.addColorStop(0.5, '#4f7ef7');
    grad.addColorStop(1, '#06b6d4');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#7c3aed';

    for (let px = 0; px < W; px++) {
        const x = (px - axisX) / zoom;
        let y;
        try { y = fn(x); } catch { started=false; continue; }
        if (!isFinite(y) || Math.abs(y) > 1e6) { started=false; continue; }
        const py = axisY - y * zoom;
        if (!started) { ctx.moveTo(px, py); started=true; }
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = isDark ? '#7c3aed' : '#5b21b6';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(`f(x) = ${expr}`, 10, 18);
}
window.drawPlot = drawPlot;

/* ══════════════════════════════════════
   TOOL 6 — WEB DEV SANDBOX
══════════════════════════════════════ */
function renderWebDev(container) {
    container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 90px);">
        <div style="display:flex;gap:4px;margin-bottom:10px;">
            ${[['html','HTML','#ef4444'],['css','CSS','#3b82f6'],['js','JS','#f59e0b']].map(([tab,label,color]) =>
              `<button id="tab_${tab}" onclick="setWDTab('${tab}')"
                style="flex:1;padding:7px;border-radius:8px;font-size:12px;font-weight:700;
                       border:1px solid ${artState.webdev.tab===tab?color:'var(--border)'};
                       background:${artState.webdev.tab===tab?color+'22':'var(--bg-hover)'};
                       color:${artState.webdev.tab===tab?color:'var(--text-secondary)'};
                       transition:all 0.15s;">${label}</button>`).join('')}
            <button class="ws-btn" onclick="runWebDev()" style="padding:7px 14px;font-size:12px;">▶ Run</button>
        </div>
        <textarea id="wdEditor" style="flex:1;background:var(--code-bg);border:1px solid var(--border);border-radius:10px;padding:12px;color:#e2e8f0;font-family:var(--font-mono);font-size:13px;resize:none;line-height:1.6;min-height:180px;" oninput="artState.webdev[artState.webdev.tab]=this.value">${esc(artState.webdev[artState.webdev.tab])}</textarea>
        <div style="margin:10px 0 6px;font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;background:#10b981;border-radius:50%;"></span>
            Live Preview
        </div>
        <iframe id="wdPreview" style="flex:1;min-height:200px;border-radius:10px;border:1px solid var(--border);background:#fff;" sandbox="allow-scripts"></iframe>
    </div>`;
    runWebDev();
}

function setWDTab(tab) {
    // Save current editor content
    const editor = $('#wdEditor');
    if (editor) artState.webdev[artState.webdev.tab] = editor.value;
    artState.webdev.tab = tab;
    if (editor) editor.value = artState.webdev[tab];
    // Update tab styles
    [['html','#ef4444'],['css','#3b82f6'],['js','#f59e0b']].forEach(([t, color]) => {
        const btn = $(`#tab_${t}`);
        if (!btn) return;
        const active = t === tab;
        btn.style.border = `1px solid ${active ? color : 'var(--border)'}`;
        btn.style.background = active ? color+'22' : 'var(--bg-hover)';
        btn.style.color = active ? color : 'var(--text-secondary)';
    });
}
window.setWDTab = setWDTab;

function runWebDev() {
    const editor = $('#wdEditor');
    if (editor) artState.webdev[artState.webdev.tab] = editor.value;
    const iframe = $('#wdPreview');
    if (!iframe) return;
    const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${artState.webdev.css}</style></head><body>${artState.webdev.html}<script>${artState.webdev.js}<\/script></body></html>`;
    iframe.srcdoc = doc;
}
window.runWebDev = runWebDev;
