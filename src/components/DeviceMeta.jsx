export default function DeviceMeta({ deviceName, battery }) {
  return (
    <div className="meta">
      <span>{deviceName}</span>
      <span>Bateria: {battery}</span>
    </div>
  );
}
