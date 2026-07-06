import { useRef, useState } from 'react';
import { useOximeter } from './hooks/useOximeter.js';
import { METRICS, WAVE_METRIC } from './lib/metrics.js';
import UnsupportedWarning from './components/UnsupportedWarning.jsx';
import Toolbar from './components/Toolbar.jsx';
import Vitals from './components/Vitals.jsx';
import Wave from './components/Wave.jsx';
import DeviceMeta from './components/DeviceMeta.jsx';
import Log from './components/Log.jsx';
import MetricDetail from './components/MetricDetail.jsx';
import ConnectionStats from './components/ConnectionStats.jsx';
import ConnectionHistory from './components/ConnectionHistory.jsx';

export default function App() {
  const waveRef = useRef(null);
  const [view, setView] = useState(
    () => new URLSearchParams(location.search).get('view') ?? 'home',
  );
  const {
    supported, vitals, history, waveHistory, battery, deviceName, status, active, logs,
    connectionEvents, clearConnectionHistory,
    connect, disconnect,
  } = useOximeter((v) => waveRef.current?.push(v));

  const metric = view === 'wave' ? WAVE_METRIC : METRICS[view];
  const waveSamples = waveHistory.current;

  return (
    <>
      <h1>Oxímetro PC-60FW</h1>
      <div className="subtitle">Leitura em tempo real via Web Bluetooth (Nordic UART Service)</div>

      <div className="app">
        {!supported && <UnsupportedWarning />}

        <Toolbar
          supported={supported}
          active={active}
          status={status}
          onConnect={connect}
          onDisconnect={disconnect}
        />

        {view === 'connection' ? (
          <ConnectionHistory
            events={connectionEvents}
            onClear={clearConnectionHistory}
            onBack={() => setView('home')}
          />
        ) : metric ? (
          <MetricDetail
            metric={metric}
            history={metric.key === 'wave' ? waveSamples.slice() : history[metric.key]}
            current={
              metric.key === 'wave'
                ? (waveSamples.length ? waveSamples[waveSamples.length - 1].v : '--')
                : vitals[metric.key]
            }
            onBack={() => setView('home')}
          />
        ) : (
          <>
            <Vitals vitals={vitals} onSelect={setView} />

            <Wave apiRef={waveRef} onSelect={setView} />

            <ConnectionStats events={connectionEvents} onSelect={setView} />

            <DeviceMeta deviceName={deviceName} battery={battery} />

            <Log entries={logs} />
          </>
        )}
      </div>
    </>
  );
}
