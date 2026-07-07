import { WAVE_METRIC } from '../lib/metrics.js';
import TimeSeriesChart from './TimeSeriesChart.jsx';

export default function Wave({ data, onSelect }) {
  const m = WAVE_METRIC;
  return (
    <div className="wave-panel clickable" onClick={() => onSelect('wave')}>
      <div className="label">Curva pletismográfica (experimental)</div>
      <div onClick={(e) => e.stopPropagation()}>
        <TimeSeriesChart
          data={data}
          color={m.color}
          unit={m.unit}
          decimals={m.decimals}
          yMin={m.yMin}
          yMax={m.yMax}
          pxPerSec={m.pxPerSec}
          showMs={m.showMs}
        />
      </div>
      <div className="card-hint">ver detalhes →</div>
    </div>
  );
}
