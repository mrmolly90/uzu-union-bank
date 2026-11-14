'use client';

import { useEffect } from 'react';
import { useRatesStore } from '@/store/rates';
import { useWebSocket } from './useWebSocket';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export function useExchangeRates() {
  const { updateRate, setRates } = useRatesStore();
  const { connected, subscribe } = useWebSocket(WS_URL);

  useEffect(() => {
    const unsub1 = subscribe('rates:initial', (rates: any[]) => {
      setRates(rates);
    });
    const unsub2 = subscribe('rates:update', (rate: any) => {
      updateRate(rate);
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [subscribe, setRates, updateRate]);

  return { connected };
}