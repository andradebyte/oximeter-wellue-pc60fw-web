import { useEffect, useState } from 'react';
import { computeStats, formatDuration } from '../lib/connectionStats.js';

// Resumo clicável do histórico de conexão, no mesmo estilo dos outros painéis
// da home (Wave, Vitals) — abre a tela de detalhe com a linha do tempo completa.
export default function ConnectionStats({ events, onSelect }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = computeStats(events, now);
  const isConnected = stats.currentState === 'connected';
  const isUnknown = stats.currentState === 'unknown';

  return (
    <div className="panel conn-panel clickable" onClick={() => onSelect('connection')}>
      <div className="label">Histórico de conexão</div>

      <div className="conn-status">
        <span className={`dot ${isConnected ? 'on' : isUnknown ? '' : 'err'}`} />
        <span>
          {isUnknown
            ? 'Nenhuma conexão registrada ainda'
            : `${isConnected ? 'Conectado' : 'Desconectado'} há ${formatDuration(stats.ongoingMs)}`}
        </span>
      </div>

      <div className="conn-grid">
        <div className="conn-stat">
          <span className="conn-num">{formatDuration(stats.totalConnectedMs)}</span>
          <span className="conn-caption">tempo conectado</span>
        </div>
        <div className="conn-stat">
          <span className="conn-num">{formatDuration(stats.totalDisconnectedMs)}</span>
          <span className="conn-caption">tempo desconectado</span>
        </div>
        <div className="conn-stat">
          <span className="conn-num">{stats.disconnectCount}</span>
          <span className="conn-caption">desconexões</span>
        </div>
      </div>

      <div className="card-hint">ver histórico completo →</div>
    </div>
  );
}
