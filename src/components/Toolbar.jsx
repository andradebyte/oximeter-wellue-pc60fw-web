export default function Toolbar({ supported, active, status, onConnect, onDisconnect }) {
  return (
    <div className="toolbar">
      <button onClick={onConnect} disabled={!supported || active}>🔗 Conectar oxímetro</button>
      <button onClick={onDisconnect} disabled={!active} className="secondary">Desconectar</button>
      <div className="status">
        <span className={`dot ${status.state}`} />
        <span>{status.text}</span>
      </div>
    </div>
  );
}
