import { useEffect, useRef, useState } from 'react';

const PAD = { top: 10, right: 12, bottom: 22, left: 40 };
const GRID = '#24304f';
const TEXT_MUTED = '#8b97b5';
const TEXT = '#e8edf7';
const TOOLTIP_BG = '#0d1226';

function niceYTicks(lo, hi, count = 4) {
  const span = hi - lo || 1;
  const mag = 10 ** Math.floor(Math.log10(span / count));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= span / count) ?? mag;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(v);
  return ticks;
}

function fmtClock(t, withMs = false) {
  const base = new Date(t).toLocaleTimeString('pt-BR');
  return withMs ? `${base},${String(t % 1000).padStart(3, '0')}` : base;
}

export default function TimeSeriesChart({
  data, color, unit, decimals = 0, yMin, yMax,
  pxPerSec = 12,
  showMs = false,
}) {
  const canvasRef = useRef(null);
  const [offsetSec, setOffsetSec] = useState(0);
  const [hoverX, setHoverX] = useState(null);
  const drag = useRef(null);

  function plotWidth() {
    return Math.max(50, (canvasRef.current?.clientWidth ?? 300) - PAD.left - PAD.right);
  }

  function maxOffset() {
    if (data.length < 2) return 0;
    const spanSec = (data[data.length - 1].t - data[0].t) / 1000;
    return Math.max(0, spanSec - plotWidth() / pxPerSec);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pw = w - PAD.left - PAD.right;
      const ph = h - PAD.top - PAD.bottom;

      if (!data.length) {
        ctx.fillStyle = TEXT_MUTED;
        ctx.font = '13px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Aguardando dados…', w / 2, h / 2);
        return;
      }

      const viewEnd = data[data.length - 1].t - offsetSec * 1000;
      const windowMs = (pw / pxPerSec) * 1000;
      const viewStart = viewEnd - windowMs;

      let lo = yMin;
      let hi = yMax;
      for (const p of data) {
        if (p.v < lo) lo = Math.floor(p.v);
        if (p.v > hi) hi = Math.ceil(p.v);
      }
      const xOf = (t) => PAD.left + ((t - viewStart) / 1000) * pxPerSec;
      const yOf = (v) => PAD.top + ph - ((v - lo) / (hi - lo)) * ph;

      ctx.font = '10px "Segoe UI", system-ui, sans-serif';

      for (const v of niceYTicks(lo, hi)) {
        const y = yOf(v);
        ctx.strokeStyle = GRID;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(w - PAD.right, y);
        ctx.stroke();
        ctx.fillStyle = TEXT_MUTED;
        ctx.textAlign = 'right';
        ctx.fillText(String(Math.round(v * 10) / 10).replace('.', ','), PAD.left - 6, y + 3);
      }

      const tickSec = [1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pxPerSec >= 70) ?? 300;
      const tickMs = tickSec * 1000;
      ctx.textAlign = 'center';
      for (let t = Math.ceil(viewStart / tickMs) * tickMs; t <= viewEnd; t += tickMs) {
        const x = xOf(t);
        if (x < PAD.left - 1) continue;
        ctx.strokeStyle = GRID;
        ctx.beginPath();
        ctx.moveTo(x, PAD.top + ph);
        ctx.lineTo(x, PAD.top + ph + 4);
        ctx.stroke();
        ctx.fillStyle = TEXT_MUTED;
        const lbl = fmtClock(t);
        const halfW = ctx.measureText(lbl).width / 2;
        ctx.fillText(lbl, Math.min(Math.max(x, PAD.left + halfW), w - halfW - 2), h - 6);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD.left, PAD.top, pw, ph);
      ctx.clip();
      const visible = data.filter((p) => p.t >= viewStart - 5000 && p.t <= viewEnd + 5000);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      visible.forEach((p, i) => {
        if (i === 0) ctx.moveTo(xOf(p.t), yOf(p.v));
        else ctx.lineTo(xOf(p.t), yOf(p.v));
      });
      ctx.stroke();

      if (offsetSec === 0) {
        const last = data[data.length - 1];
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(xOf(last.t), yOf(last.v), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (hoverX != null && visible.length) {
        const tAtPointer = viewStart + ((hoverX - PAD.left) / pxPerSec) * 1000;
        const p = visible.reduce((a, b) =>
          Math.abs(b.t - tAtPointer) < Math.abs(a.t - tAtPointer) ? b : a);
        const x = xOf(p.t);
        const y = yOf(p.v);
        ctx.strokeStyle = TEXT_MUTED;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, PAD.top);
        ctx.lineTo(x, PAD.top + ph);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        const label =
          `${fmtClock(p.t, showMs)} · ${p.v.toFixed(decimals).replace('.', ',')} ${unit}`.trim();
        ctx.font = '11px "Segoe UI", system-ui, sans-serif';
        const tw = ctx.measureText(label).width + 14;
        const bx = Math.min(Math.max(x - tw / 2, PAD.left), w - PAD.right - tw);
        const by = Math.max(y - 32, 2);
        ctx.fillStyle = TOOLTIP_BG;
        ctx.strokeStyle = GRID;
        ctx.beginPath();
        ctx.roundRect(bx, by, tw, 20, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = TEXT;
        ctx.textAlign = 'center';
        ctx.fillText(label, bx + tw / 2, by + 14);
      }
      ctx.restore();
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [data, offsetSec, hoverX, color, unit, decimals, yMin, yMax, pxPerSec, showMs]);

  function onPointerDown(e) {
    drag.current = { x: e.clientX, offset: offsetSec, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      if (Math.abs(dx) > 3) drag.current.moved = true;
      const next = Math.min(Math.max(drag.current.offset + dx / pxPerSec, 0), maxOffset());
      setOffsetSec(next);
      setHoverX(null);
    } else {
      setHoverX(e.clientX - rect.left);
    }
  }

  function onPointerUp() {
    drag.current = null;
  }

  function onPointerLeave() {
    drag.current = null;
    setHoverX(null);
  }

  return (
    <div className="chart-wrap">
      <canvas
        ref={canvasRef}
        className="chart"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      />
      {offsetSec > 0 && (
        <button className="live-btn" onClick={() => setOffsetSec(0)}>
          ● Voltar ao vivo
        </button>
      )}
    </div>
  );
}
