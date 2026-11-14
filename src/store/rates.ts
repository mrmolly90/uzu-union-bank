'use client';

import { create } from 'zustand';
import type { ExchangeRatePair } from '@/types';

interface RatesState {
  rates: Record<string, ExchangeRatePair>;
  setRates: (rates: ExchangeRatePair[]) => void;
  updateRate: (rate: ExchangeRatePair) => void;
  getRate: (base: string, quote: string) => ExchangeRatePair | undefined;
}

export const useRatesStore = create<RatesState>((set, get) => ({
  rates: {},

  setRates: (rates) => {
    const map: Record<string, ExchangeRatePair> = {};
    rates.forEach((r) => {
      map[`${r.base}/${r.quote}`] = r;
    });
    set({ rates: map });
  },

  updateRate: (rate) => {
    set((state) => ({
      rates: { ...state.rates, [`${rate.base}/${rate.quote}`]: rate },
    }));
  },

  getRate: (base, quote) => {
    return get().rates[`${base}/${quote}`];
  },
}));