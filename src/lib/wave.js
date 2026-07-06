// Curva pletismográfica: buffer circular de amostras desenhado no canvas
export function createWave(canvas, length = 260) {
  const ctx = canvas.getContext('2d');
  const samples = new Array(length).fill(null);

  function push(v) {
    samples.push(v);
    samples.shift();
    draw();
  }

  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    samples.forEach((v, i) => {
      if (v === null) return;
      const x = (i / (samples.length - 1)) * w;
      const y = h - (v / 100) * (h - 20) - 10; // amplitude ~0–100
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  return { push, draw };
}
