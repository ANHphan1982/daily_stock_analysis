import type React from 'react';
import { useCallback, useState } from 'react';
import { getParsedApiError } from '../../api/error';
import { stocksApi, type ExtractItem } from '../../api/stocks';
import { systemConfigApi, SystemConfigConflictError } from '../../api/systemConfig';
import { Badge, Button } from '../common';

const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const IMG_MAX = 5 * 1024 * 1024; // 5MB
const FILE_MAX = 2 * 1024 * 1024; // 2MB
const TEXT_MAX = 100 * 1024; // 100KB

interface IntelligentImportProps {
  stockListValue: string;
  configVersion: string;
  maskToken: string;
  onMerged: (newValue: string) => void | Promise<void>;
  disabled?: boolean;
}

type ItemWithChecked = ExtractItem & { id: string; checked: boolean };

function getConfidenceMeta(confidence: 'high' | 'medium' | 'low') {
  if (confidence === 'high') {
    return { label: 'Cao', badge: 'success' as const };
  }
  if (confidence === 'low') {
    return { label: 'Thấp', badge: 'warning' as const };
  }
  return { label: 'Trung', badge: 'default' as const };
}

function normalizeConfidence(confidence?: string | null): 'high' | 'medium' | 'low' {
  if (confidence === 'high' || confidence === 'low' || confidence === 'medium') {
    return confidence;
  }
  return 'medium';
}

function mergeItems(
  prev: ItemWithChecked[],
  newItems: ExtractItem[]
): ItemWithChecked[] {
  const byCode = new Map<string, ItemWithChecked>();
  const confOrder: Record<'high' | 'medium' | 'low', number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  const failed: ItemWithChecked[] = [];
  for (const p of prev) {
    if (p.code) {
      byCode.set(p.code, p);
    } else {
      failed.push(p);
    }
  }
  for (const it of newItems) {
    const normalizedConfidence = normalizeConfidence(it.confidence);
    if (it.code) {
      const existing = byCode.get(it.code);
      if (!existing) {
        byCode.set(it.code, {
          ...it,
          confidence: normalizedConfidence,
          id: `${it.code}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          checked: normalizedConfidence === 'high',
        });
      } else {
        const existingConfidence = normalizeConfidence(existing.confidence);
        const shouldUpgradeConfidence = confOrder[normalizedConfidence] > confOrder[existingConfidence];
        const shouldFillName = !existing.name && !!it.name;

        if (shouldUpgradeConfidence || shouldFillName) {
          byCode.set(it.code, {
            ...existing,
            name: it.name || existing.name,
            confidence: shouldUpgradeConfidence ? normalizedConfidence : existingConfidence,
            checked: shouldUpgradeConfidence
              ? (normalizedConfidence === 'high' ? true : existing.checked)
              : existing.checked,
          });
        }
      }
    } else {
      failed.push({
        ...it,
        confidence: normalizedConfidence,
        id: `fail-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        checked: false,
      });
    }
  }
  return [...byCode.values(), ...failed];
}

export const IntelligentImport: React.FC<IntelligentImportProps> = ({
  stockListValue,
  configVersion,
  maskToken,
  onMerged,
  disabled,
}) => {
  const [items, setItems] = useState<ItemWithChecked[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const parseCurrentList = useCallback(() => {
    return stockListValue
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }, [stockListValue]);

  const addItems = useCallback((newItems: ExtractItem[]) => {
    setItems((prev) => mergeItems(prev, newItems));
  }, []);

  const handleImageFile = useCallback(
    async (file: File) => {
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
      if (!IMG_EXT.includes(ext)) {
        setError('Ảnh chỉ hỗ trợ JPG, PNG, WebP, GIF');
        return;
      }
      if (file.size > IMG_MAX) {
        setError('Ảnh không quá 5MB');
        return;
      }
      setError(null);
      setIsLoading(true);
      try {
        const res = await stocksApi.extractFromImage(file);
        addItems(res.items ?? res.codes.map((c) => ({ code: c, name: null, confidence: 'medium' })));
      } catch (e) {
        const parsed = getParsedApiError(e);
        const err = e && typeof e === 'object' ? (e as { response?: { status?: number }; code?: string }) : null;
        let fallback = 'Nhận dạng thất bại, vui lòng thử lại';
        if (err?.response?.status === 429) fallback = 'Yêu cầu quá nhiều, vui lòng thử lại sau';
        else if (err?.code === 'ECONNABORTED') fallback = 'Yêu cầu hết thời gian, kiểm tra mạng và thử lại';
        setError(parsed.message || fallback);
      } finally {
        setIsLoading(false);
      }
    },
    [addItems],
  );

  const handleDataFile = useCallback(
    async (file: File) => {
      if (file.size > FILE_MAX) {
        setError('Tệp không quá 2MB');
        return;
      }
      setError(null);
      setIsLoading(true);
      try {
        const res = await stocksApi.parseImport(file);
        addItems(res.items ?? res.codes.map((c) => ({ code: c, name: null, confidence: 'medium' })));
      } catch (e) {
        const parsed = getParsedApiError(e);
        setError(parsed.message || 'Phân tích thất bại');
      } finally {
        setIsLoading(false);
      }
    },
    [addItems],
  );

  const handlePasteParse = useCallback(() => {
    const t = pasteText.trim();
    if (!t) return;
    if (new Blob([t]).size > TEXT_MAX) {
      setError('Văn bản dán không quá 100KB');
      return;
    }
    setError(null);
    setIsLoading(true);
    stocksApi
      .parseImport(undefined, t)
      .then((res) => {
        addItems(res.items ?? res.codes.map((c) => ({ code: c, name: null, confidence: 'medium' })));
        setPasteText('');
      })
      .catch((e) => {
        const parsed = getParsedApiError(e);
        setError(parsed.message || 'Phân tích thất bại');
      })
      .finally(() => setIsLoading(false));
  }, [pasteText, addItems]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled || isLoading) return;
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
      if (IMG_EXT.includes(ext)) void handleImageFile(f);
      else void handleDataFile(f);
    },
    [disabled, isLoading, handleImageFile, handleDataFile],
  );

  const onImageInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void handleImageFile(f);
      e.target.value = '';
    },
    [handleImageFile],
  );

  const onDataFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void handleDataFile(f);
      e.target.value = '';
    },
    [handleDataFile],
  );

  const toggleChecked = useCallback((id: string) => {
    setItems((prev) => prev.map((p) => (p.id === id && p.code ? { ...p, checked: !p.checked } : p)));
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setItems((prev) => prev.map((p) => (p.code ? { ...p, checked } : p)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setPasteText('');
    setError(null);
  }, []);

  const mergeToWatchlist = useCallback(async () => {
    const toMerge = items.filter((i) => i.checked && i.code).map((i) => i.code!);
    if (toMerge.length === 0) return;
    if (!configVersion) {
      setError('Vui lòng tải cấu hình trước khi gộp');
      return;
    }
    const current = parseCurrentList();
    const merged = [...new Set([...current, ...toMerge])];
    const value = merged.join(',');

    setIsMerging(true);
    setError(null);
    try {
      await systemConfigApi.update({
        configVersion,
        maskToken,
        reloadNow: true,
        items: [{ key: 'STOCK_LIST', value }],
      });
      setItems([]);
      setPasteText('');
      await onMerged(value);
    } catch (e) {
      if (e instanceof SystemConfigConflictError) {
        await onMerged(value);
        setError('Cấu hình đã cập nhật, vui lòng nhấn "Gộp vào danh sách theo dõi" lại');
      } else {
        setError(e instanceof Error ? e.message : 'Lưu gộp thất bại');
      }
    } finally {
      setIsMerging(false);
    }
  }, [items, configVersion, maskToken, onMerged, parseCurrentList]);

  const validCount = items.filter((i) => i.code).length;
  const checkedCount = items.filter((i) => i.checked && i.code).length;

  return (
    <div className="space-y-4">
      <div className="settings-surface-panel settings-border-strong rounded-xl border p-4 shadow-soft-card">
        <p className="text-sm font-medium text-foreground">Hỗ trợ ảnh, tệp CSV/Excel và văn bản từ clipboard</p>
        <p className="mt-1 text-xs leading-5 text-secondary-text">
          Nhận dạng ảnh cần cấu hình Vision Model trước. Nên kiểm tra kết quả trước khi gộp vào danh sách theo dõi.
        </p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        className={`flex min-h-[96px] flex-col gap-4 rounded-xl border border-dashed  p-4 transition-colors ${
          isDragging ? 'settings-drag-active' : 'settings-border-overlay settings-surface-overlay'
        } ${disabled || isLoading ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer">
            <Button type="button" variant="settings-secondary" disabled={disabled || isLoading}>
              Chọn ảnh
            </Button>
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif" className="hidden" onChange={onImageInput} disabled={disabled || isLoading} />
          </label>
          <label className="cursor-pointer">
            <Button type="button" variant="settings-secondary" disabled={disabled || isLoading}>
              Chọn tệp
            </Button>
            <input type="file" accept=".csv,.xlsx,.txt" className="hidden" onChange={onDataFileInput} disabled={disabled || isLoading} />
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea
            placeholder="Hoặc dán văn bản sao từ CSV/Excel..."
            className="input-surface settings-surface-strong settings-border-strong min-h-[72px] w-full rounded-xl border px-3 py-2 text-sm text-foreground shadow-soft-card transition-colors placeholder:text-muted-text focus:outline-none"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            disabled={disabled || isLoading}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 sm:self-start"
            onClick={handlePasteParse}
            disabled={disabled || isLoading || !pasteText.trim()}
          >
            Phân tích
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-secondary-text">Đang xử lý...</p>}
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Nên kiểm tra từng mục trước khi gộp. Độ tin cậy cao mặc định được chọn, trung/thấp cần xác nhận thủ công.
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary-text">
              {validCount} mục có thể gộp, đã chọn {checkedCount} mục
            </span>
            <div className="flex gap-2">
              <button type="button" className="text-xs text-secondary-text transition-colors hover:text-foreground" onClick={() => toggleAll(true)}>
                Chọn tất cả
              </button>
              <button type="button" className="text-xs text-secondary-text transition-colors hover:text-foreground" onClick={() => toggleAll(false)}>
                Bỏ chọn
              </button>
              <button type="button" className="text-xs text-secondary-text transition-colors hover:text-foreground" onClick={clearAll}>
                Xóa tất cả
              </button>
            </div>
          </div>
          <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-xl border border-border/40 bg-background/18 p-2">
            {items.map((it) => {
              const confidence = normalizeConfidence(it.confidence);
              const confidenceMeta = getConfidenceMeta(confidence);

              return (
                <div
                  key={it.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    it.code ? 'border-border/40 bg-elevated/62' : 'border-danger/25 bg-danger/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={it.checked}
                    onChange={() => toggleChecked(it.id)}
                    disabled={!it.code || disabled}
                    className="settings-input-checkbox h-4 w-4 rounded border-border/70 bg-base"
                  />
                  <span className={it.code ? 'font-medium text-foreground' : 'font-medium text-danger'}>
                    {it.code || 'Phân tích thất bại'}
                  </span>
                  {it.name && <span className="text-secondary-text">({it.name})</span>}
                  <div className="ml-auto flex items-center gap-2">
                    <Badge variant={confidenceMeta.badge} size="sm">
                      {confidenceMeta.label}
                    </Badge>
                    <button
                      type="button"
                      className="text-secondary-text transition-colors hover:text-foreground"
                      onClick={() => removeItem(it.id)}
                      disabled={disabled}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="primary"
            className="mt-2"
            onClick={() => void mergeToWatchlist()}
            disabled={disabled || isMerging || checkedCount === 0}
          >
            {isMerging ? 'Đang lưu...' : 'Gộp vào danh sách theo dõi'}
          </Button>
        </div>
      )}
    </div>
  );
};
