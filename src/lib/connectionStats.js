const STORAGE_KEY = 'pc60fw-connection-log';
const MAX_EVENTS = 1000;

export function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {}
}

export function recordEvent(events, type, t = Date.now()) {
  const last = events[events.length - 1];
  if (last?.type === type) return events;
  const next = [...events, { type, t }];
  const trimmed = next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
  persist(trimmed);
  return trimmed;
}

export function clearEvents() {
  persist([]);
  return [];
}

export function computeStats(events, now = Date.now()) {
  const sessions = [];
  const gaps = [];
  let totalConnectedMs = 0;
  let totalDisconnectedMs = 0;
  let disconnectCount = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const end = events[i + 1]?.t ?? null;

    if (ev.type === 'connected' && end !== null) {
      const durationMs = end - ev.t;
      sessions.push({ start: ev.t, end, durationMs });
      totalConnectedMs += durationMs;
    } else if (ev.type === 'disconnected') {
      disconnectCount += 1;
      if (end !== null) {
        const durationMs = end - ev.t;
        gaps.push({ start: ev.t, end, durationMs });
        totalDisconnectedMs += durationMs;
      }
    }
  }

  const lastEvent = events[events.length - 1] ?? null;
  const currentState = lastEvent ? lastEvent.type : 'unknown';
  const since = lastEvent?.t ?? null;
  const ongoingMs = since !== null ? Math.max(0, now - since) : 0;

  if (currentState === 'connected') totalConnectedMs += ongoingMs;
  if (currentState === 'disconnected') totalDisconnectedMs += ongoingMs;

  return {
    currentState,
    since,
    ongoingMs,
    disconnectCount,
    totalConnectedMs,
    totalDisconnectedMs,
    sessions: sessions.reverse(),
    gaps: gaps.reverse(),
  };
}

export function formatDuration(ms) {
  if (ms == null || ms < 0) return '--';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')} s`;
  return `${s} s`;
}
