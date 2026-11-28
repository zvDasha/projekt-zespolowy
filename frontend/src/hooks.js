import { useEffect, useState } from 'react';
import { api } from './api';

// WebSocket wywołuje library:update, a hook pobiera aktualne dane.
export function useApi(path, poll = 0) {
  const [state, setState] = useState({ path, data: null, loading: !!path, error: '' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) {
      setState({ path, data: null, loading: false, error: '' });
      return;
    }
    const controller = new AbortController();
    let running = false;
    let queued = false;
    async function load() {
      if (controller.signal.aborted) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        const data = await api(path, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ path, data, loading: false, error: '' });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((old) => ({
            path,
            data: old.path === path ? old.data : null,
            loading: false,
            error: error.message,
          }));
      } finally {
        running = false;
        if (queued && !controller.signal.aborted) {
          queued = false;
          load();
        }
      }
    }
    load();
    const timer = poll
      ? setInterval(() => {
          if (!document.hidden) load();
        }, poll)
      : null;
    window.addEventListener('focus', load);
    window.addEventListener('library:update', load);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener('library:update', load);
    };
  }, [path, poll, version]);
  return {
    ...(state.path === path ? state : { data: null, loading: !!path, error: '' }),
    reload: () => setVersion((v) => v + 1),
  };
}
