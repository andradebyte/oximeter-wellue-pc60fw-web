import { useEffect, useRef } from 'react';
import { createWave } from '../lib/wave.js';

// As amostras (~30 Hz) não passam pelo estado do React: o pai recebe `apiRef`
// e chama apiRef.current.push(v) direto no canvas.
export default function Wave({ apiRef, onSelect }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const wave = createWave(canvasRef.current);
    wave.draw();
    apiRef.current = wave;
    return () => { apiRef.current = null; };
  }, [apiRef]);

  return (
    <div className="wave-panel clickable" onClick={() => onSelect('wave')}>
      <div className="label">Curva pletismográfica (experimental)</div>
      <canvas ref={canvasRef} width="1040" height="240" />
      <div className="card-hint">ver detalhes →</div>
    </div>
  );
}
