import { useEffect, useState } from 'react';
import { API_URL, refreshData } from './api';

export function useRealtime() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let socket;
    let timer;
    let stopped = false;
    const url = new URL(API_URL + '/ws', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    function connect() {
      socket = new WebSocket(url);
      socket.onopen = () => {
        setConnected(true);
        refreshData(); // Pobierz też zmiany pominięte podczas rozłączenia.
      };
      socket.onmessage = (event) => {
        if (JSON.parse(event.data).type === 'update') refreshData();
      };
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) timer = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
    }
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket.close();
    };
  }, []);
  return connected;
}
