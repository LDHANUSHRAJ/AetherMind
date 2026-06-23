/**
 * support.js — DC Framework Runtime
 * Implements: <x-dc>, <helmet>, <sc-if>, <sc-for>, {{ }} templates, DCLogic
 */
(function () {
  'use strict';

  // ── React shim (used by Chat page for rich AI message rendering) ──────────
  window.React = {
    createElement(type, props) {
      const children = Array.prototype.slice.call(arguments, 2).flat(Infinity);
      return { $$react: true, type, props: props || {}, children };
    }
  };

  function domFromReact(vnode) {
    if (vnode == null || vnode === false) return null;
    if (typeof vnode === 'string' || typeof vnode === 'number') {
      return document.createTextNode(String(vnode));
    }
    if (Array.isArray(vnode)) {
      const f = document.createDocumentFragment();
      vnode.forEach(c => { const n = domFromReact(c); if (n) f.appendChild(n); });
      return f;
    }
    if (!vnode.$$react) return document.createTextNode(String(vnode));
    const el = document.createElement(vnode.type);
    for (const [k, v] of Object.entries(vnode.props || {})) {
      if (v == null) continue;
      if (k === 'style') {
        if (typeof v === 'object') Object.assign(el.style, v);
        else el.setAttribute('style', v);
      } else if (k === 'className') {
        el.className = v;
      } else if (k === 'dangerouslySetInnerHTML') {
        el.innerHTML = v.__html;
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k !== 'key' && k !== 'ref') {
        try { el.setAttribute(k === 'htmlFor' ? 'for' : k, String(v)); } catch (_) {}
      }
    }
    (vnode.children || []).forEach(c => {
      const n = domFromReact(c);
      if (n) el.appendChild(n);
    });
    return el;
  }

  // ── DCLogic base class ────────────────────────────────────────────────────
  class DCLogic {
    constructor() {
      this._host = null;
      this._template = '';
      this._mounted = false;
      this._pending = false;
    }

    setState(update, callback) {
      this.state = Object.assign({}, this.state,
        typeof update === 'function' ? update(this.state) : update);
      if (!this._pending) {
        this._pending = true;
        Promise.resolve().then(() => {
          this._pending = false;
          this._render();
          if (typeof callback === 'function') callback();
        }).catch(e => console.error('DC setState render error:', e));
      }
    }

    _render() {
      if (!this._host) return;
      const vals = this.renderVals();

      // Save focus path + selection before wiping DOM
      const active = document.activeElement;
      let focusPath = null, selStart = null, selEnd = null;
      if (active && this._host.contains(active)) {
        focusPath = getPath(active, this._host);
        try { selStart = active.selectionStart; selEnd = active.selectionEnd; } catch (_) {}
      }

      applyTemplate(this._host, this._template, vals);
      syncInputValues(this._host);

      // Restore focus + caret
      if (focusPath !== null) {
        const el = fromPath(focusPath, this._host);
        if (el && typeof el.focus === 'function') {
          el.focus();
          if (selStart != null) {
            try { el.setSelectionRange(selStart, selEnd); } catch (_) {}
          }
        }
      }

      if (this._mounted) {
        try { this.componentDidUpdate(); }
        catch (e) { console.error('DC componentDidUpdate error (EX-6: check Supabase fallback):', e); }
      }
    }

    componentDidMount() {}
    componentDidUpdate() {}
    renderVals() { return {}; }
  }

  window.DCLogic = DCLogic;

  // ── Focus path helpers ────────────────────────────────────────────────────
  function getPath(node, root) {
    const path = [];
    let cur = node;
    while (cur && cur !== root) {
      const p = cur.parentNode;
      if (!p) return null;
      path.unshift(Array.from(p.childNodes).indexOf(cur));
      cur = p;
    }
    return path;
  }

  function fromPath(path, root) {
    let cur = root;
    for (const i of path) {
      if (!cur || !cur.childNodes[i]) return null;
      cur = cur.childNodes[i];
    }
    return cur;
  }

  // ── Style helpers ─────────────────────────────────────────────────────────
  function styleToStr(v) {
    if (typeof v === 'string') return v;
    if (!v || typeof v !== 'object') return '';
    return Object.entries(v)
      .map(([k, val]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${val}`)
      .join(';');
  }

  // Stable hover class registry (survives re-renders)
  const hoverMap = new Map();
  let hoverSeq = 0;
  let hoverSheet = null;

  function hoverClass(css) {
    if (!css) return '';
    if (hoverMap.has(css)) return hoverMap.get(css);
    if (!hoverSheet) {
      const s = document.createElement('style');
      s.id = 'dc-hovers';
      document.head.appendChild(s);
      hoverSheet = s.sheet;
    }
    const cls = `dch${hoverSeq++}`;
    hoverSheet.insertRule(`.${cls}:hover{${css}}`, hoverSheet.cssRules.length);
    hoverMap.set(css, cls);
    return cls;
  }

  // ── Template engine ───────────────────────────────────────────────────────
  const TPLRE = /\{\{\s*([\w.]+)\s*\}\}/g;

  function resolve(key, vals) {
    let v = vals;
    for (const p of key.trim().split('.')) {
      if (v == null) return undefined;
      v = v[p];
    }
    return v;
  }

  function interp(str, vals) {
    return str.replace(TPLRE, (_, k) => {
      const v = resolve(k, vals);
      return (v == null || typeof v === 'object') ? '' : String(v);
    });
  }

  function singleKey(str) {
    const m = str.trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    return m ? m[1] : null;
  }

  const EV = {
    onclick: 'click', onchange: 'input', onkeydown: 'keydown',
    onblur: 'blur', onmouseleave: 'mouseleave', onmouseenter: 'mouseenter',
    onfocus: 'focus', onsubmit: 'submit', oninput: 'input', onkeyup: 'keyup'
  };

  function applyTemplate(host, html, vals) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const nodes = buildNodes(Array.from(tmp.childNodes), vals);
    while (host.firstChild) host.removeChild(host.firstChild);
    nodes.forEach(n => host.appendChild(n));
  }

  function syncInputValues(host) {
    host.querySelectorAll('input[data-dc-val], textarea[data-dc-val]').forEach(el => {
      el.value = el.getAttribute('data-dc-val');
    });
  }

  function buildNodes(list, vals) {
    const out = [];
    for (const n of list) {
      const r = buildNode(n, vals);
      if (Array.isArray(r)) out.push(...r);
      else if (r != null) out.push(r);
    }
    return out;
  }

  function buildNode(node, vals) {
    // Text node
    if (node.nodeType === 3) {
      const key = singleKey(node.textContent);
      if (key) {
        const v = resolve(key, vals);
        if (v != null && typeof v === 'object' && (v.$$react || typeof v.type === 'string')) {
          return domFromReact(v);
        }
        return document.createTextNode(v == null ? '' : String(v));
      }
      return document.createTextNode(interp(node.textContent, vals));
    }
    if (node.nodeType !== 1) return null;

    const tag = node.tagName.toLowerCase();

    // ── sc-if ──
    if (tag === 'sc-if') {
      const raw = node.getAttribute('value') || '';
      const key = singleKey(raw);
      const val = key ? resolve(key, vals) : !!raw;
      if (!val && val !== 0 && val !== '') return null;
      return buildNodes(Array.from(node.childNodes), vals);
    }

    // ── sc-for ──
    if (tag === 'sc-for') {
      const listRaw = node.getAttribute('list') || '';
      const asName = node.getAttribute('as') || 'item';
      const key = singleKey(listRaw);
      const list = key ? resolve(key, vals) : [];
      if (!Array.isArray(list)) return [];
      const kids = Array.from(node.childNodes);
      return list.flatMap(item =>
        buildNodes(kids, Object.assign({}, vals, { [asName]: item }))
      );
    }

    // ── Regular element ──
    const el = document.createElement(tag);

    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const raw = attr.value;

      // Events (case-insensitive match)
      const evName = EV[name];
      if (evName) {
        const key = singleKey(raw);
        if (key) {
          const fn = resolve(key, vals);
          if (typeof fn === 'function') el.addEventListener(evName, fn);
        }
        continue;
      }

      // style
      if (name === 'style') {
        const key = singleKey(raw);
        if (key) {
          el.setAttribute('style', styleToStr(resolve(key, vals)));
        } else {
          el.setAttribute('style', interp(raw, vals));
        }
        continue;
      }

      // style-hover
      if (name === 'style-hover') {
        const key = singleKey(raw);
        const css = key ? styleToStr(resolve(key, vals)) : raw;
        if (css) el.classList.add(hoverClass(css));
        continue;
      }

      // value (input / textarea / select)
      if (name === 'value') {
        const key = singleKey(raw);
        const v = String(key ? (resolve(key, vals) ?? '') : raw);
        el.setAttribute('data-dc-val', v); // used by syncInputValues
        el.setAttribute('value', v);
        continue;
      }

      // disabled
      if (name === 'disabled') {
        const key = singleKey(raw);
        const v = key ? resolve(key, vals) : (raw !== 'false');
        if (v) el.disabled = true;
        continue;
      }

      // autofocus / data-dc-autofocus (use data-dc-autofocus in templates to avoid
      // the browser auto-focusing template inputs while they sit in the live DOM)
      if (name === 'autofocus' || name === 'data-dc-autofocus') {
        const key = singleKey(raw);
        const v = key ? resolve(key, vals) : (raw !== 'false');
        if (v) setTimeout(() => el.focus(), 50);
        continue;
      }

      // Everything else (href, placeholder, type, rows, min, max, step, class, title…)
      el.setAttribute(attr.name, interp(raw, vals));
    }

    // Children
    for (const child of Array.from(node.childNodes)) {
      const built = buildNode(child, vals);
      if (Array.isArray(built)) built.forEach(n => el.appendChild(n));
      else if (built != null) el.appendChild(built);
    }

    return el;
  }

  // ── x-dc custom element ───────────────────────────────────────────────────
  customElements.define('x-dc', class extends HTMLElement {
    connectedCallback() {
      // Wait for full DOM parse so the text/x-dc script is available
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._init(), { once: true });
      } else {
        this._init();
      }
    }

    _init() {
      // Move <helmet> contents into <head>
      const helmet = this.querySelector('helmet');
      if (helmet) {
        Array.from(helmet.childNodes).forEach(n => document.head.appendChild(n.cloneNode(true)));
        helmet.remove();
      }

      // Grab the component script
      const scriptEl = document.querySelector('script[type="text/x-dc"][data-dc-script]');
      if (!scriptEl) { console.error('DC: no data-dc-script found'); return; }

      const template = this.innerHTML;

      // Instantiate Component (defined in the script block)
      let ComponentClass;
      try {
        ComponentClass = new Function('DCLogic', scriptEl.textContent + ';\nreturn Component;')(DCLogic);
      } catch (e) {
        console.error('DC: Component load failed', e);
        return;
      }

      const inst = new ComponentClass();
      inst._host = this;
      inst._template = template;

      // First render
      applyTemplate(this, template, inst.renderVals());
      syncInputValues(this);

      inst._mounted = true;
      try { inst.componentDidMount(); }
      catch (e) { console.error('DC componentDidMount error (EX-6: check Supabase fallback):', e); }
    }
  });

})();
