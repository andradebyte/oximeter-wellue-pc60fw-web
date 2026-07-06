import { useEffect, useRef } from 'react';
import { createWave } from '../lib/wave.js';

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
