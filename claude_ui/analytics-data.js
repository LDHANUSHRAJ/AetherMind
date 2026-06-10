/* ═══════════════════════════════════════════════════════════
   AetherMind Analytics Engine v1.0
   Reads REAL data from localStorage.
   Conversations: am_convs_v2
   Each assistant message may contain:
     [AETHERMIND_LOG]
       domain: CODING|MATH|STATS|WEB_DEV|SECURITY
       topic: <string>
       subtopic: <string>
       tokens_used: <number>
       session_id: YYYY-MM-DD
     [/AETHERMIND_LOG]
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  class AetherAnalyticsEngine {
    constructor() {
      try {
        this.conversations = JSON.parse(localStorage.getItem('am_convs_v2') || '[]');
      } catch (_) {
        this.conversations = [];
      }
      this._logsCache = null;
      this._userMsgsCache = null;
    }

    /* ══ Internal: Parse [AETHERMIND_LOG] blocks from assistant messages ══ */
    _getLogs() {
      if (this._logsCache !== null) return this._logsCache;
      const logs = [];
      const VALID_DOMAIN = /^(MATH|STATS|CODING|WEB_DEV|SECURITY)$/;
      for (const conv of this.conversations) {
        for (const msg of (conv.messages || [])) {
          if (msg.role !== 'assistant' || !msg.content) continue;
          const re = /\[AETHERMIND_LOG\]([\s\S]*?)\[\/AETHERMIND_LOG\]/g;
          let m;
          while ((m = re.exec(msg.content)) !== null) {
            const log = { _convId: conv.id, _convDate: conv.createdAt || '' };
            for (const line of m[1].trim().split('\n')) {
              const ci = line.indexOf(':');
              if (ci > 0) {
                const k = line.substring(0, ci).trim();
                const v = line.substring(ci + 1).trim();
                if (k && !k.startsWith('[') && !v.startsWith('[')) log[k] = v;
              }
            }
            if (log.domain && VALID_DOMAIN.test(log.domain)) logs.push(log);
          }
        }
      }
      this._logsCache = logs;
      return logs;
    }

    /* ══ Internal: All user messages ══ */
    _getUserMsgs() {
      if (this._userMsgsCache !== null) return this._userMsgsCache;
      const msgs = [];
      for (const conv of this.conversations) {
        for (const msg of (conv.messages || [])) {
          if (msg.role === 'user') {
            msgs.push({ content: msg.content || '', convDate: conv.createdAt || '' });
          }
        }
      }
      this._userMsgsCache = msgs;
      return msgs;
    }

    /* ══ Helpers ══ */
    _todayStr() { return new Date().toISOString().split('T')[0]; }

    _dateStr(daysAgo) {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    }

    _relDate(dateStr) {
      if (!dateStr) return 'Unknown';
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
      if (diff <= 0) return 'Today';
      if (diff === 1) return 'Yesterday';
      if (diff < 7) return `${diff}d ago`;
      if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
      return `${Math.floor(diff / 30)}mo ago`;
    }

    /* Domain detection from message text (fallback when no LOG blocks) */
    _detectDomain(text) {
      const t = (text || '').toLowerCase();
      if (/website|html|css|react|component|frontend|web\s?app|ui\s|navbar|landing|vue|angular/.test(t)) return 'WEB_DEV';
      if (/solve|derivative|integral|matrix|calculus|equation|differentiate|eigenvalue|theorem|proof|algebra/.test(t)) return 'MATH';
      if (/mean|variance|probability|hypothesis|regression|distribution|p-value|bayes|confidence|chi\s?square/.test(t)) return 'STATS';
      if (/encrypt|decrypt|xss|csrf|sql\s?injection|vulnerability|penetration|cryptography|exploit|firewall|hash/.test(t)) return 'SECURITY';
      if (/\bcode\b|function|algorithm|\bsort\b|debug|python|java|javascript|\barray\b|tree|recursion|leetcode|program/.test(t)) return 'CODING';
      return null;
    }

    /* Format token count to human-readable */
    formatTokens(n) {
      const val = n || 0;
      if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
      if (val >= 1e3) return (val / 1e3).toFixed(1) + 'k';
      return String(val);
    }

    /* ══════════════════════════════════
       PUBLIC API
    ══════════════════════════════════ */

    /* Total user messages ever sent */
    getTotalQueries() { return this._getUserMsgs().length; }

    /* User messages sent today */
    getQueriesToday() {
      const today = this._todayStr();
      return this._getUserMsgs().filter(m => m.convDate.startsWith(today)).length;
    }

    /* Total token consumption */
    getTotalTokens() {
      const logs = this._getLogs();
      if (logs.length > 0) {
        const n = logs.reduce((s, l) => s + (parseInt(l.tokens_used) || 0), 0);
        if (n > 0) return n;
      }
      // Fallback: estimate ~4 chars per token
      let chars = 0;
      for (const c of this.conversations) {
        for (const m of (c.messages || [])) chars += (m.content?.length || 0);
      }
      return Math.round(chars / 4);
    }

    /* Tokens used today */
    getTokensToday() {
      const today = this._todayStr();
      const logs = this._getLogs();
      if (logs.length > 0) {
        return logs
          .filter(l => l.session_id === today)
          .reduce((s, l) => s + (parseInt(l.tokens_used) || 0), 0);
      }
      let chars = 0;
      for (const c of this.conversations) {
        if ((c.createdAt || '').startsWith(today)) {
          for (const m of (c.messages || [])) chars += (m.content?.length || 0);
        }
      }
      return Math.round(chars / 4);
    }

    /* Most-used domain */
    getActiveDomain() {
      const logs = this._getLogs();
      const counts = {};
      if (logs.length > 0) {
        for (const l of logs) if (l.domain) counts[l.domain] = (counts[l.domain] || 0) + 1;
      } else {
        for (const m of this._getUserMsgs()) {
          const d = this._detectDomain(m.content);
          if (d) counts[d] = (counts[d] || 0) + 1;
        }
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (!top) return '—';
      const labels = { CODING: 'Coding', MATH: 'Math', STATS: 'Statistics', WEB_DEV: 'Web Dev', SECURITY: 'Security' };
      return labels[top[0]] || top[0];
    }

    /* Current streak in days */
    getStreak() {
      const dates = new Set();
      for (const l of this._getLogs()) {
        if (l.session_id && /^\d{4}-\d{2}-\d{2}$/.test(l.session_id)) dates.add(l.session_id);
      }
      if (dates.size === 0) {
        for (const c of this.conversations) {
          const d = (c.createdAt || '').split('T')[0];
          if (d) dates.add(d);
        }
      }
      if (dates.size === 0) return 0;
      const today = this._todayStr();
      const yesterday = this._dateStr(1);
      if (!dates.has(today) && !dates.has(yesterday)) return 0;
      let expected = dates.has(today) ? today : yesterday;
      let streak = 0;
      while (dates.has(expected)) {
        streak++;
        const d = new Date(expected); d.setDate(d.getDate() - 1);
        expected = d.toISOString().split('T')[0];
      }
      return streak;
    }

    getTotalSessions() { return this.conversations.length; }

    getSessionsToday() {
      const today = this._todayStr();
      return this.conversations.filter(c => (c.createdAt || '').startsWith(today)).length;
    }

    /* Domain query counts: {CODING, MATH, STATS, WEB_DEV, SECURITY} */
    getDomainBreakdown() {
      const domains = { CODING: 0, MATH: 0, STATS: 0, WEB_DEV: 0, SECURITY: 0 };
      const logs = this._getLogs();
      if (logs.length > 0) {
        for (const l of logs) if (l.domain && l.domain in domains) domains[l.domain]++;
      } else {
        for (const m of this._getUserMsgs()) {
          const d = this._detectDomain(m.content);
          if (d && d in domains) domains[d]++;
        }
      }
      return domains;
    }

    /* Topics with mastery scores */
    getTopics(limit = 20) {
      const logs = this._getLogs();
      const map = {};
      if (logs.length > 0) {
        for (const l of logs) {
          const key = (l.topic || '').trim();
          if (!key || key.startsWith('[')) continue;
          if (!map[key]) map[key] = { topic: key, domain: l.domain || 'CODING', timesAsked: 0, lastDate: '' };
          map[key].timesAsked++;
          const ld = l.session_id || '';
          if (ld > map[key].lastDate) map[key].lastDate = ld;
        }
      } else {
        // Fallback: use conversation titles as proxy topics
        for (const c of this.conversations) {
          const title = (c.title || '').trim();
          if (!title || title === 'New Chat' || title === 'Untitled') continue;
          const key = title.length > 48 ? title.substring(0, 48) + '…' : title;
          const domain = this._detectDomain(title) || 'CODING';
          const d = (c.createdAt || '').split('T')[0];
          if (!map[key]) map[key] = { topic: key, domain, timesAsked: 0, lastDate: '' };
          map[key].timesAsked++;
          if (d > map[key].lastDate) map[key].lastDate = d;
        }
      }
      const list = Object.values(map).sort((a, b) => b.timesAsked - a.timesAsked).slice(0, limit);
      const max = list[0]?.timesAsked || 1;
      return list.map(t => ({
        ...t,
        mastery: Math.min(100, Math.round((t.timesAsked / max) * 100)),
        lastStudied: this._relDate(t.lastDate),
      }));
    }

    /* Daily query/token data for line chart */
    getUsageOverTime(days = 30) {
      const buckets = {};
      const labels = [];
      for (let i = days - 1; i >= 0; i--) {
        const s = this._dateStr(i);
        buckets[s] = { queries: 0, tokens: 0 };
        labels.push(s);
      }
      const logs = this._getLogs();
      if (logs.length > 0) {
        for (const l of logs) {
          if (l.session_id && buckets[l.session_id]) {
            buckets[l.session_id].queries++;
            buckets[l.session_id].tokens += parseInt(l.tokens_used) || 0;
          }
        }
      } else {
        for (const c of this.conversations) {
          const s = (c.createdAt || '').split('T')[0];
          if (buckets[s]) {
            const userMsgs = (c.messages || []).filter(m => m.role === 'user').length;
            const chars = (c.messages || []).reduce((sum, m) => sum + (m.content?.length || 0), 0);
            buckets[s].queries += userMsgs;
            buckets[s].tokens += Math.round(chars / 4);
          }
        }
      }
      return {
        labels: labels.map(s => {
          const d = new Date(s + 'T00:00:00');
          return d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' });
        }),
        queries: labels.map(s => buckets[s].queries),
        tokens: labels.map(s => buckets[s].tokens),
      };
    }

    /* 364 activity cells for heatmap */
    getActivityHeatmap() {
      const activity = {};
      const logs = this._getLogs();
      for (const l of logs) {
        if (l.session_id && /^\d{4}-\d{2}-\d{2}$/.test(l.session_id)) {
          activity[l.session_id] = (activity[l.session_id] || 0) + 1;
        }
      }
      if (Object.keys(activity).length === 0) {
        for (const c of this.conversations) {
          const s = (c.createdAt || '').split('T')[0];
          if (s) activity[s] = (activity[s] || 0) + ((c.messages || []).filter(m => m.role === 'user').length || 1);
        }
      }
      return Array.from({ length: 364 }, (_, i) => {
        const s = this._dateStr(363 - i);
        return { date: s, count: activity[s] || 0 };
      });
    }

    /* Token analytics by domain */
    getTokenAnalytics() {
      const domainTokens = { CODING: 0, MATH: 0, STATS: 0, WEB_DEV: 0, SECURITY: 0 };
      let total = 0;
      for (const l of this._getLogs()) {
        const t = parseInt(l.tokens_used) || 0;
        if (l.domain && l.domain in domainTokens) domainTokens[l.domain] += t;
        total += t;
      }
      if (total === 0) {
        // Distribute total tokens proportional to domain query breakdown
        total = this.getTotalTokens();
        const breakdown = this.getDomainBreakdown();
        const bTotal = Object.values(breakdown).reduce((s, v) => s + v, 0) || 1;
        for (const d of Object.keys(domainTokens)) {
          domainTokens[d] = Math.round((breakdown[d] / bTotal) * total);
        }
      }
      return { domainTokens, total };
    }

    /* Estimated cost in USD */
    getCostEstimate(ratePerK = 0.002) {
      return ((this.getTotalTokens() / 1000) * ratePerK).toFixed(2);
    }

    /* AI response rate (quality signal) */
    getEfficiency() {
      let user = 0, ai = 0;
      for (const c of this.conversations) {
        for (const m of (c.messages || [])) {
          if (m.role === 'user') user++;
          else if (m.role === 'assistant') ai++;
        }
      }
      if (user === 0) return 0;
      return Math.min(100, Math.round((ai / user) * 100));
    }

    /* Suggested topics from conversations (weakest/oldest) */
    getSuggestedTopics(n = 3) {
      const topics = this.getTopics(50);
      if (topics.length === 0) return [];
      // Sort by oldest lastDate and lowest mastery
      return topics
        .filter(t => t.mastery < 80)
        .sort((a, b) => {
          const dateScore = new Date(a.lastDate || '2000-01-01') - new Date(b.lastDate || '2000-01-01');
          const masteryScore = a.mastery - b.mastery;
          return dateScore + masteryScore * 1000;
        })
        .slice(0, n);
    }
  }

  window.AetherAnalytics = new AetherAnalyticsEngine();
})();
