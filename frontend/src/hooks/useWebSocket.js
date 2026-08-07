import { useEffect, useRef, useState } from 'react';

// Connects to the backend WebSocket feed and delivers parsed messages.
export default function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        cbRef.current?.(JSON.parse(e.data));
      } catch {}
    };
    return () => ws.close();
  }, []);

  return connected;
}
