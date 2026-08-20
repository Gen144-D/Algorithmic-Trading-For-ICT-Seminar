import { useEffect, useRef, useState } from 'react';

// Connects to the backend WebSocket feed (authenticated) and delivers parsed messages.
export default function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  useEffect(() => {
    let ws;
    let retry = null;

    const connect = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setConnected(false);
        return;
      }
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${protocol}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          cbRef.current?.(JSON.parse(e.data));
        } catch {}
      };
    };

    connect();
    return () => {
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return connected;
}