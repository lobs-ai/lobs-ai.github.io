// pulse.js — Fetch and render live telemetry from pulse.json
'use strict';

(function () {
  const PULSE_URL = 'pulse.json';
  const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min = stale

  async function loadPulse() {
    const container = document.getElementById('pulseContent');
    if (!container) return;

    try {
      const res = await fetch(PULSE_URL + '?t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      renderPulse(container, data);
    } catch (err) {
      container.innerHTML = '<div class="pulse-loading">System telemetry unavailable</div>';
    }
  }

  function renderPulse(el, d) {
    const age = Date.now() - new Date(d.generated_at).getTime();
    const isStale = age > STALE_THRESHOLD_MS;
    const statusClass = isStale ? 'stale' : '';
    const statusText = d.system.status === 'online' && !isStale ? 'SYSTEM ONLINE' :
                       isStale ? 'DATA STALE' : 'SYSTEM OFFLINE';

    const uptimeStr = d.system.uptime_human || '—';
    const successRate = d.workers.success_rate_30d;
    const totalRuns = d.workers.runs_30d;
    const tasksCompleted = d.tasks.total_completed;
    const tokensTotal = formatTokens(d.tokens_30d.total);

    // Live workers section
    const liveWorkersHTML = d.live_workers.length > 0 ?
      `<div class="pulse-stat" style="grid-column: span 4;">
        <div class="pulse-stat-value" style="font-size:1rem;letter-spacing:0;">
          ${d.live_workers.map(w =>
            `<span class="pulse-token-badge" style="margin:2px;">${w.agent} · ${formatDuration(w.running_for_seconds)} · ${w.provider}</span>`
          ).join(' ')}
        </div>
        <div class="pulse-stat-label">Running Now</div>
      </div>` : '';

    el.innerHTML = `
      <div class="pulse-status-row reveal">
        <div class="pulse-beacon ${statusClass}"></div>
        <span class="pulse-status-text ${statusClass}">${statusText}</span>
        <span class="pulse-token-badge" style="margin-left:8px;">v${d.system.version}</span>
      </div>
      <div class="pulse-updated reveal">Last updated ${timeAgo(d.generated_at)}</div>

      <div class="pulse-stats reveal">
        <div class="pulse-stat">
          <div class="pulse-stat-value">${uptimeStr}</div>
          <div class="pulse-stat-label">Uptime</div>
        </div>
        <div class="pulse-stat">
          <div class="pulse-stat-value">${totalRuns.toLocaleString()}</div>
          <div class="pulse-stat-label">Worker Runs</div>
          <div class="pulse-stat-sub">last 30 days</div>
        </div>
        <div class="pulse-stat">
          <div class="pulse-stat-value">${successRate}%</div>
          <div class="pulse-stat-label">Success Rate</div>
          <div class="pulse-stat-sub">${d.workers.succeeded_30d} / ${totalRuns}</div>
        </div>
        <div class="pulse-stat">
          <div class="pulse-stat-value">${tokensTotal}</div>
          <div class="pulse-stat-label">Tokens (30d)</div>
          <div class="pulse-stat-sub">${formatTokens(d.tokens_30d.input)} in · ${formatTokens(d.tokens_30d.output)} out</div>
        </div>
        ${liveWorkersHTML}
      </div>

      <div class="pulse-bottom reveal">
        <div class="pulse-panel">
          <div class="pulse-panel-title"><span class="panel-icon">⚡</span> Recent Activity</div>
          ${renderActivityFeed(d.recent_activity)}
        </div>
        <div class="pulse-panel">
          <div class="pulse-panel-title"><span class="panel-icon">🤖</span> Agent Breakdown <span class="pulse-token-badge" style="margin-left:auto;">${d.workers.active} active</span></div>
          ${renderAgentBars(d.workers.by_agent, totalRuns)}
        </div>
      </div>
    `;

    // Re-trigger reveal observer for new elements
    el.querySelectorAll('.reveal').forEach(node => {
      if (window._revealObserver) window._revealObserver.observe(node);
      else node.classList.add('revealed');
    });
  }

  function renderActivityFeed(activity) {
    if (!activity || activity.length === 0) {
      return '<div class="pulse-empty">No recent activity</div>';
    }
    const items = activity.slice(0, 10).map(a => {
      const verb = a.type === 'completed' ? 'completed a task' :
                   a.type === 'failed' ? 'task failed' : 'working…';
      return `<li class="pulse-feed-item">
        <span class="feed-dot ${a.type}"></span>
        <span class="feed-text"><span class="feed-agent">${a.agent}</span> ${verb}</span>
        <span class="feed-time">${timeAgo(a.timestamp)}</span>
      </li>`;
    }).join('');
    return `<ul class="pulse-feed">${items}</ul>`;
  }

  function renderAgentBars(agents, maxRuns) {
    if (!agents || agents.length === 0) {
      return '<div class="pulse-empty">No agent data</div>';
    }
    const sorted = [...agents].sort((a, b) => b.runs - a.runs);
    const topRuns = sorted[0]?.runs || 1;
    const bars = sorted.map(a => {
      const pct = Math.round((a.runs / topRuns) * 100);
      return `<div class="agent-bar-row">
        <span class="agent-bar-label">${a.agent}</span>
        <div class="agent-bar-track"><div class="agent-bar-fill" style="width:${pct}%"></div></div>
        <span class="agent-bar-count">${a.runs} runs</span>
        <span class="agent-bar-rate">${a.success_rate}%</span>
      </div>`;
    }).join('');
    return `<div class="agent-bars">${bars}</div>`;
  }

  function formatTokens(n) {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  function formatDuration(seconds) {
    if (seconds >= 3600) return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
    if (seconds >= 60) return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
    return seconds + 's';
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  // Load on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPulse);
  } else {
    loadPulse();
  }
})();
