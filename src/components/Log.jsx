import { useEffect, useRef } from 'react';

export default function Log({ entries }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  return (
    <div className="log" ref={ref}>
      {entries.join('\n')}
    </div>
  );
}
