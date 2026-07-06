import { formatValue } from '../lib/metrics.js';
import TimeSeriesChart from './TimeSeriesChart.jsx';

function fmtTime(t, withMs = false) {
  const base = new Date(t).toLocaleTimeString('pt-BR');
  return withMs ? `${base},${String(t % 1000).padStart(3, '0')}` : base;
}

function arrivalInterval(history) {
  if (history.length < 2) return null;
  const recent = history.slice(-31);
  const deltas = [];
  for (let i = 1; i < recent.length; i++) deltas.push(recent[i].t - recent[i - 1].t);
  const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  if (avgMs < 1000) return `~${Math.round(avgMs)} ms`;
  return `~${(avgMs / 1000).toFixed(1).replace('.', ',')} s`;
}

export default function MetricDetail({ metric, history, current, onBack }) {
  const interval = arrivalInterval(history);
  const latest = history[history.length - 1];
  const recent = history.slice(-(metric.readingsCount ?? 12)).reverse();

  return (
    <div className="detail">
      <div className="detail-header">
        <button className="secondary back-btn" onClick={onBack}>← Voltar</button>
        <h2 style={{ color: metric.color }}>{metric.fullLabel}</h2>
      </div>

      <div className="panel desc">
        <p>{metric.description}</p>
        <p className="example">{metric.example}</p>
      </div>

      <div className={`card ${metric.key} detail-current`}>
        <div className="label">Valor atual</div>
        <div className="value">{current}</div>
        <div className="unit">{metric.unitLabel ?? metric.unit}</div>
      </div>

      <div className="panel">
        <div className="label">Gráfico ao vivo</div>
        <TimeSeriesChart
          data={history}
          color={metric.color}
          unit={metric.unit}
          decimals={metric.decimals}
          yMin={metric.yMin}
          yMax={metric.yMax}
          pxPerSec={metric.pxPerSec}
          showMs={metric.showMs}
        />
        <div className="chart-hint">
          O eixo X cresce a cada leitura; quando passa da tela, arraste o gráfico para
          navegar pelo histórico.
        </div>
      </div>

      <div className="panel">
        <div className="label">Recebimento</div>
        <div className="cadence">
          <p>{metric.cadence}</p>
          <p>
            {interval
              ? <>Medido agora: chegando a cada <strong>{interval}</strong> · {history.length} leitura(s) nesta sessão · última às {fmtTime(latest.t, metric.showMs)}</>
              : 'Nenhuma leitura recebida ainda — conecte o oxímetro e coloque o dedo.'}
          </p>
        </div>
        {recent.length > 0 && (
          <ul className="readings">
            {recent.map((r, i) => (
              <li key={`${r.t}-${i}`}>
                <span className="reading-time">{fmtTime(r.t, metric.showMs)}</span>
                <span className="reading-value" style={{ color: metric.color }}>
                  {`${formatValue(metric, r.v)} ${metric.unit}`.trim()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
