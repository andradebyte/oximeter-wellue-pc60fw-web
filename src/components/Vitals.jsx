import { METRICS } from '../lib/metrics.js';

function VitalCard({ metric, value, onSelect }) {
  return (
    <button type="button" className={`card ${metric.key}`} onClick={() => onSelect(metric.key)}>
      <div className="label">{metric.label}</div>
      <div className="value">{value}</div>
      <div className="unit">{metric.unit}</div>
      <div className="card-hint">ver detalhes →</div>
    </button>
  );
}

export default function Vitals({ vitals, onSelect }) {
  return (
    <div className="vitals">
      {Object.values(METRICS).map((metric) => (
        <VitalCard key={metric.key} metric={metric} value={vitals[metric.key]} onSelect={onSelect} />
      ))}
    </div>
  );
}
