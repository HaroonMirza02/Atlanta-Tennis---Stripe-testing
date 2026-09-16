import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(serverUrl: string, onStockUpdate: (data: { productId: string; availableStock: number }) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io(serverUrl);

    socketRef.current.on('stock_updated', (data) => {
      onStockUpdate(data);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [serverUrl, onStockUpdate]);

  return socketRef.current;
}