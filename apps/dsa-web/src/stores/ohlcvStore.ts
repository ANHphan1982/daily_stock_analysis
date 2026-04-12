import { create } from 'zustand';
import { fetchOHLCV } from '../api/ohlcv';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import type { OHLCVBar, Period } from '../types/ohlcv';

interface OHLCVState {
  symbol: string | null;
  period: Period;
  data: OHLCVBar[] | null;
  isLoading: boolean;
  error: ParsedApiError | null;

  fetchData: (symbol: string, period?: Period) => Promise<void>;
  setPeriod: (period: Period) => void;
  reset: () => void;
}

const INITIAL: Pick<OHLCVState, 'symbol' | 'period' | 'data' | 'isLoading' | 'error'> = {
  symbol: null,
  period: '1d',
  data: null,
  isLoading: false,
  error: null,
};

export const useOHLCVStore = create<OHLCVState>((set, get) => ({
  ...INITIAL,

  fetchData: async (symbol, period) => {
    const resolvedPeriod = period ?? get().period;

    set({ isLoading: true, error: null, symbol, period: resolvedPeriod });

    try {
      const result = await fetchOHLCV(symbol, resolvedPeriod);
      set({ data: result.data, isLoading: false });
    } catch (err) {
      set({ error: getParsedApiError(err), isLoading: false });
    }
  },

  setPeriod: (period) => {
    set({ period });
    const { symbol } = get();
    if (symbol) {
      get().fetchData(symbol, period);
    }
  },

  reset: () => set({ ...INITIAL }),
}));
