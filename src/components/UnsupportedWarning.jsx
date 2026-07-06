export default function UnsupportedWarning() {
  return (
    <div className="warn">
      Este navegador não suporta Web Bluetooth. Use o <strong>Chrome</strong> ou <strong>Edge</strong>{' '}
      no Android, Windows, macOS ou Linux (não funciona no iOS nem no Firefox).
    </div>
  );
}
