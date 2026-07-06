import { useEffect, useState } from 'react';
import { computeStats, formatDuration } from '../lib/connectionStats.js';

function fmtDateTime(t) {
  return new Date(t).toLocaleString('pt-BR');
}

export default function ConnectionHistory({ events, onClear, onBack }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = computeStats(events, now);
  const isConnected = stats.currentState === 'connected';
  const isUnknown = stats.currentState === 'unknown';

  const timeline = [
    ...stats.sessions.map((s) => ({ ...s, kind: 'connected' })),
    ...stats.gaps.map((g) => ({ ...g, kind: 'disconnected' })),
  ].sort((a, b) => b.start - a.start);

  return (
    <div className="detail">
      <div className="detail-header">
        <button className="secondary back-btn" onClick={onBack}>← Voltar</button>
        <h2>Histórico de conexão</h2>
      </div>

      <div className="panel desc">
        <p>
          Registra cada vez que o oxímetro conecta e desconecta de verdade (o link BLE
          cai), quanto tempo cada sessão durou e quantas quedas aconteceram. Fica salvo
          no navegador (localStorage) — sobrevive a recarregar a página.
        </p>
      </div>

      <div className="panel conn-status-big">
        <span className={`dot ${isConnected ? 'on' : isUnknown ? '' : 'err'}`} />
        <span>
          {isUnknown
            ? 'Nenhuma conexão registrada ainda'
            : `${isConnected ? 'Conectado' : 'Desconectado'} há ${formatDuration(stats.ongoingMs)}`}
        </span>
      </div>

      <div className="conn-summary-grid">
        <div className="card">
          <div className="label">Tempo conectado</div>
          <div className="value conn-value">{formatDuration(stats.totalConnectedMs)}</div>
        </div>
        <div className="card">
          <div className="label">Tempo desconectado</div>
          <div className="value conn-value">{formatDuration(stats.totalDisconnectedMs)}</div>
        </div>
        <div className="card">
          <div className="label">Desconexões</div>
          <div className="value conn-value">{stats.disconnectCount}</div>
        </div>
      </div>

      <div className="panel">
        <div className="label">Linha do tempo ({timeline.length})</div>
        {timeline.length === 0 ? (
          <p className="cadence">Nenhuma sessão concluída ainda — conecte e desconecte o oxímetro para começar a registrar.</p>
        ) : (
          <ul className="readings conn-timeline">
            {timeline.map((item, i) => (
              <li key={`${item.start}-${i}`}>
                <span className="conn-timeline-left">
                  <span className={`dot ${item.kind === 'connected' ? 'on' : 'err'}`} />
                  <span className="reading-time">
                    {item.kind === 'connected' ? 'Conectado' : 'Desconectado'}: {fmtDateTime(item.start)} → {fmtDateTime(item.end)}
                  </span>
                </span>
                <span className="reading-value">{formatDuration(item.durationMs)}</span>
              </li>
            ))}
          </ul>
        )}
        {events.length > 0 && (
          <button type="button" className="secondary clear-btn" onClick={onClear}>
            Limpar histórico
          </button>
        )}
      </div>
    </div>
  );
}
