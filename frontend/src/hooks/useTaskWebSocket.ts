import { useState, useEffect } from 'react';
import { TaskTelemetry } from '../types';

export function useTaskWebSocket(taskId: string | null) {
  const [telemetry, setTelemetry] = useState<TaskTelemetry | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setTelemetry(null);
      setIsConnected(false);
      return;
    }

    const wsUrl = `ws://localhost:8000/ws/tasks/${taskId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data: TaskTelemetry = JSON.parse(event.data);
        setTelemetry(data);
      } catch (err) {
        console.error('[ws] Failed to parse telemetry frame:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[ws] WebSocket connection error:', err);
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [taskId]);

  return { telemetry, isConnected, error };
}
