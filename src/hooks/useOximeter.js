import { useEffect, useMemo, useRef, useState } from 'react';
import { createOximeter, BATTERY_LEVELS } from '../lib/oximeter.js';
import { loadEvents, recordEvent, clearEvents } from '../lib/connectionStats.js';

const supported = typeof navigator !== 'undefined' && !!navigator.bluetooth;
const demoMode = new URLSearchParams(location.search).has('demo');

const HISTORY_CAP = 3600;
const WAVE_CAP = 9000;
const WAVE_TICK_MS = 300;

function timestamp(msg) {
  return `[${new Date().toLocaleTimeString()}] ${msg}`;
}

function appendReading(list, v) {
  const now = Date.now();
  // vitals history is 1 reading/s max — the device may send several frames per second
  const last = list[list.length - 1];
  if (last && now - last.t < 1000) return list;
  const next = list.length >= HISTORY_CAP ? list.slice(1) : list.slice();
  next.push({ t: now, v });
  return next;
}

export function useOximeter(onWaveSample) {
  const [vitals, setVitals] = useState({ spo2: '--', pulse: '--', pi: '--' });
  const [history, setHistory] = useState({ spo2: [], pulse: [], pi: [] });
  const [battery, setBattery] = useState('--');
  const [deviceName, setDeviceName] = useState('Nenhum dispositivo');
  const [status, setStatus] = useState(
    supported
      ? { text: 'Desconectado', state: '' }
      : { text: 'Web Bluetooth indisponível', state: 'err' },
  );
  const [active, setActive] = useState(false);
  const [logs, setLogs] = useState(['Aguardando conexão…']);

  const [connectionEvents, setConnectionEvents] = useState(() => loadEvents());
  function recordLink(connected) {
    setConnectionEvents((prev) => recordEvent(prev, connected ? 'connected' : 'disconnected'));
  }
  function clearConnectionHistory() {
    setConnectionEvents(clearEvents());
  }

  const onWaveSampleRef = useRef(onWaveSample);
  onWaveSampleRef.current = onWaveSample;

  const waveHistory = useRef([]);
  const [waveTick, setWaveTick] = useState(0);
  const lastWaveTick = useRef(0);

  const oximeter = useMemo(() => {
    function ingestVitals({ spo2, pulse, pi }) {
      const spo2Ok = spo2 > 0 && spo2 <= 100;
      const pulseOk = pulse > 0 && pulse < 255;
      const piOk = pi > 0;
      setVitals((prev) => ({
        spo2: spo2Ok ? spo2 : prev.spo2,
        pulse: pulseOk ? pulse : prev.pulse,
        pi: piOk ? pi.toFixed(1) : prev.pi,
      }));
      setHistory((prev) => ({
        spo2: spo2Ok ? appendReading(prev.spo2, spo2) : prev.spo2,
        pulse: pulseOk ? appendReading(prev.pulse, pulse) : prev.pulse,
        pi: piOk ? appendReading(prev.pi, Number(pi.toFixed(1))) : prev.pi,
      }));
    }

    function ingestWave(v) {
      onWaveSampleRef.current?.(v);
      const arr = waveHistory.current;
      arr.push({ t: Date.now(), v });
      if (arr.length > WAVE_CAP) arr.splice(0, arr.length - WAVE_CAP);
      const now = Date.now();
      if (now - lastWaveTick.current >= WAVE_TICK_MS) {
        lastWaveTick.current = now;
        setWaveTick((n) => n + 1);
      }
    }

    const instance = createOximeter({
      onVitals: ingestVitals,
      onWaveSample: ingestWave,
      onBattery: (level) => setBattery(BATTERY_LEVELS[level] ?? '?'),
      onDevice: setDeviceName,
      onStatus: (text, state = '') => setStatus({ text, state }),
      onConnectionChange: setActive,
      onLink: recordLink,
      onLog: (msg) => setLogs((prev) => [...prev, timestamp(msg)]),
    });
    return { ...instance, ingestVitals, ingestWave };
  }, []);

  const resumed = useRef(false);
  useEffect(() => {
    if (!supported || demoMode || resumed.current) return;
    resumed.current = true;
    oximeter.resumePreviousDevice();
  }, [oximeter]);

  const demoStarted = useRef(false);
  useEffect(() => {
    if (!demoMode || demoStarted.current) return;
    demoStarted.current = true;
    setLogs((prev) => [...prev, timestamp('MODO DEMO: gerando leituras simuladas (~1/s).')]);
    setDeviceName('PC-60F (demo)');
    setStatus({ text: 'Demo — dados simulados', state: 'on' });
    setActive(true);
    setBattery(BATTERY_LEVELS[3]);
    recordLink(true);

    let t = 0;
    const vitalsTimer = setInterval(() => {
      t += 1;
      oximeter.ingestVitals({
        spo2: Math.round(97 + Math.sin(t / 25) * 1.5 + (Math.random() - 0.5)),
        pulse: Math.round(72 + Math.sin(t / 12) * 6 + (Math.random() - 0.5) * 3),
        pi: 3.5 + Math.sin(t / 20) * 1.2 + (Math.random() - 0.5) * 0.4,
      });
    }, 1000);
    let w = 0;
    const waveTimer = setInterval(() => {
      w += 1;
      const beat = Math.pow(Math.max(0, Math.sin(w / 5.7)), 3);
      oximeter.ingestWave(Math.round(20 + beat * 70 + Math.random() * 4));
    }, 33);
    return () => { clearInterval(vitalsTimer); clearInterval(waveTimer); };
  }, [oximeter]);

  return {
    supported: supported || demoMode,
    vitals,
    history,
    waveHistory,
    waveTick,
    battery,
    deviceName,
    status,
    active,
    logs,
    connectionEvents,
    clearConnectionHistory,
    connect: oximeter.connect,
    disconnect: oximeter.disconnect,
  };
}
