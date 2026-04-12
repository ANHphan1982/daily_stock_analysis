import apiClient from './index';
import type {
  DailyRecommendationsRequest,
  DailyRecommendationsResponse,
  SignalMeta,
} from '../types/recommendations';

/** snake_case → camelCase shallow converter (reused from the project pattern) */
function toCamelCase<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        toCamelCase(v),
      ]),
    ) as T;
  }
  return obj as T;
}

/** camelCase → snake_case shallow converter */
function toSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [
          k.replace(/([A-Z])/g, '_$1').toLowerCase(),
          toSnakeCase(v),
        ]),
    );
  }
  return obj;
}

export const recommendationsApi = {
  /**
   * POST /api/v1/recommendations/daily
   * Chạy vn_market_scan + vn_recommendation_engine, sinh danh sách khuyến nghị mới.
   * Timeout dài hơn vì AI analysis có thể mất thời gian.
   */
  async generate(
    params: DailyRecommendationsRequest = {},
  ): Promise<DailyRecommendationsResponse> {
    const body = toSnakeCase(params);
    const response = await apiClient.post(
      '/api/v1/recommendations/daily',
      body,
      { timeout: 120_000 },
    );
    return toCamelCase<DailyRecommendationsResponse>(response.data);
  },

  /**
   * GET /api/v1/recommendations/daily
   * Lấy kết quả đã sinh trong ngày từ cache (không chạy lại AI).
   */
  async getToday(params?: {
    date?: string;
    minScore?: number;
    rating?: string;
    limit?: number;
  }): Promise<DailyRecommendationsResponse> {
    const response = await apiClient.get('/api/v1/recommendations/daily', {
      params: toSnakeCase(params ?? {}),
    });
    return toCamelCase<DailyRecommendationsResponse>(response.data);
  },

  /**
   * GET /api/v1/recommendations/signals
   * Danh sách tín hiệu kỹ thuật hỗ trợ (dùng cho UI filter dropdown).
   */
  async getSignals(): Promise<SignalMeta[]> {
    const response = await apiClient.get('/api/v1/recommendations/signals');
    const data = response.data as { signals: unknown[] };
    return toCamelCase<SignalMeta[]>(data.signals);
  },
};
