'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

type EventHandler = (data: any) => void;

export function useWebSocket(url: string) {
  const ws = useRef<WebSocket | null>(null);
  const handlers = useRef<Map<string, EventHandler>>(new Map());
  const [connected, setConnected] = useState(false);
  const reconnectAttempt = useRef(0);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
    };

    ws.current.onclose = () => {
      setConnected(false);
      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
      reconnectAttempt.current++;
      setTimeout(connect, delay);
    };

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const handler = handlers.current.get(msg.type);
        if (handler) handler(msg.payload);
      } catch { /* ignore malformed messages */ }
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      ws.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    handlers.current.set(event, handler);
    return () => { handlers.current.delete(event); };
  }, []);

  const send = useCallback((type: string, payload: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { connected, subscribe, send };
}