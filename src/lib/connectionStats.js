// Registro de conexões/desconexões do oxímetro: quanto tempo ficou conectado,
// quanto tempo ficou desconectado, quantas quedas aconteceram e o histórico de
// cada sessão. Guarda um log bruto de eventos ('connected'/'disconnected') no
// localStorage — tudo o mais (durações, contagens, sessões) é derivado desse
// log. Não depende de React.
const STORAGE_KEY = 'pc60fw-connection-log';
const MAX_EVENTS = 1000; // ~500 ciclos conecta/desconecta guardados

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
  } catch {
    // localStorage indisponível (aba anônima, quota etc.) — histórico segue só em memória
  }
}

/**
 * Adiciona um evento de conexão ('connected') ou queda ('disconnected').
 * Ignora repetições consecutivas do mesmo tipo, para não contar quedas
 * "fantasma" quando um handler dispara mais de uma vez para o mesmo estado.
 */
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

/**
 * Deriva as estatísticas a partir do log bruto: estado atual (conectado ou
 * desconectado) e há quanto tempo, total acumulado conectado/desconectado,
 * número de quedas e a lista de sessões (períodos conectados) e lacunas
 * (períodos desconectado) já concluídos — mais recente primeiro.
 */
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
    currentState, // 'connected' | 'disconnected' | 'unknown'
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
