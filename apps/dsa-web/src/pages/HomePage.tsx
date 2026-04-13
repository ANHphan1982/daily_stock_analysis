import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiErrorAlert, ConfirmDialog, Button } from '../components/common';
import { DashboardStateBlock } from '../components/dashboard';
import { StockAutocomplete } from '../components/StockAutocomplete';
import { HistoryList } from '../components/history';
import StockNewsPanel from '../components/news/StockNewsPanel';
import { ReportMarkdown, ReportSummary } from '../components/report';
import { RecommendationsPanel } from '../components/recommendations/RecommendationsPanel';
import { TaskPanel } from '../components/tasks';
import { CandlestickChart } from '../components/charts/CandlestickChart';
import { useDashboardLifecycle, useHomeDashboardState } from '../hooks';
import { useOHLCVStore } from '../stores/ohlcvStore';
import { getReportText, normalizeReportLanguage } from '../utils/reportLanguage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { BarChart3, FileText } from 'lucide-react';

type MainTab = 'report' | 'recommendations';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('recommendations');

  const {
    query,
    inputError,
    duplicateError,
    error,
    isAnalyzing,
    historyItems,
    selectedHistoryIds,
    isDeletingHistory,
    isLoadingHistory,
    isLoadingMore,
    hasMore,
    selectedReport,
    isLoadingReport,
    activeTasks,
    markdownDrawerOpen,
    setQuery,
    clearError,
    loadInitialHistory,
    refreshHistory,
    loadMoreHistory,
    selectHistoryItem,
    toggleHistorySelection,
    toggleSelectAllVisible,
    deleteSelectedHistory,
    submitAnalysis,
    notify,
    setNotify,
    syncTaskCreated,
    syncTaskUpdated,
    syncTaskFailed,
    removeTask,
    openMarkdownDrawer,
    closeMarkdownDrawer,
    selectedIds,
  } = useHomeDashboardState();

  useEffect(() => {
    document.title = 'Phân tích cổ phiếu hàng ngày - DSA';
  }, []);
  const reportLanguage = normalizeReportLanguage(selectedReport?.meta.reportLanguage);
  const reportText = getReportText(reportLanguage);

  useDashboardLifecycle({
    loadInitialHistory,
    refreshHistory,
    syncTaskCreated,
    syncTaskUpdated,
    syncTaskFailed,
    removeTask,
  });

  // OHLCV chart state
  const { data: ohlcvData, isLoading: isOhlcvLoading, error: ohlcvError, period: ohlcvPeriod, fetchData: fetchOHLCV, setPeriod: setOhlcvPeriod, reset: resetOHLCV } = useOHLCVStore();

  // Fetch OHLCV whenever the selected stock code changes
  const selectedStockCode = selectedReport?.meta.stockCode ?? null;
  useEffect(() => {
    if (selectedStockCode) {
      void fetchOHLCV(selectedStockCode);
    } else {
      resetOHLCV();
    }
  }, [selectedStockCode, fetchOHLCV, resetOHLCV]);

  const handleHistoryItemClick = useCallback((recordId: number) => {
    void selectHistoryItem(recordId);
    setSidebarOpen(false);
    setMainTab('report');
  }, [selectHistoryItem]);

  const handleSubmitAnalysis = useCallback(
    (
      stockCode?: string,
      stockName?: string,
      selectionSource?: 'manual' | 'autocomplete' | 'import' | 'image',
    ) => {
      void submitAnalysis({
        stockCode,
        stockName,
        originalQuery: query,
        selectionSource: selectionSource ?? 'manual',
      });
      setMainTab('report');
    },
    [query, submitAnalysis],
  );

  const handleAskFollowUp = useCallback(() => {
    if (selectedReport?.meta.id === undefined) {
      return;
    }

    const code = selectedReport.meta.stockCode;
    const name = selectedReport.meta.stockName;
    const rid = selectedReport.meta.id;
    navigate(`/chat?stock=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}&recordId=${rid}`);
  }, [navigate, selectedReport]);

  const handleDeleteSelectedHistory = useCallback(() => {
    void deleteSelectedHistory();
    setShowDeleteConfirm(false);
  }, [deleteSelectedHistory]);

  const sidebarContent = useMemo(
    () => (
      <div className="flex min-h-0 h-full flex-col gap-3 overflow-hidden">
        <TaskPanel tasks={activeTasks} />
        <HistoryList
          items={historyItems}
          isLoading={isLoadingHistory}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          selectedId={selectedReport?.meta.id}
          selectedIds={selectedIds}
          isDeleting={isDeletingHistory}
          onItemClick={handleHistoryItemClick}
          onLoadMore={() => void loadMoreHistory()}
          onToggleItemSelection={toggleHistorySelection}
          onToggleSelectAll={toggleSelectAllVisible}
          onDeleteSelected={() => setShowDeleteConfirm(true)}
          className="flex-1 overflow-hidden"
        />
      </div>
    ),
    [
      activeTasks,
      hasMore,
      historyItems,
      isDeletingHistory,
      isLoadingHistory,
      isLoadingMore,
      handleHistoryItemClick,
      loadMoreHistory,
      selectedIds,
      selectedReport?.meta.id,
      toggleHistorySelection,
      toggleSelectAllVisible,
    ],
  );

  return (
    <div
      data-testid="home-dashboard"
      className="flex h-[calc(100vh-5rem)] w-full flex-col overflow-hidden md:flex-row sm:h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-2rem)]"
    >
      <div className="flex-1 flex flex-col min-w-0 max-w-full lg:max-w-6xl mx-auto w-full">
        <header className="flex min-w-0 flex-shrink-0 items-center overflow-hidden px-3 py-3 md:px-4 md:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden -ml-1 flex-shrink-0 rounded-lg p-1.5 text-secondary-text transition-colors hover:bg-hover hover:text-foreground"
              title="Lịch sử"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="relative min-w-0 flex-1">
              <StockAutocomplete
                value={query}
                onChange={setQuery}
                onSubmit={(stockCode, stockName, selectionSource) => {
                  handleSubmitAnalysis(stockCode, stockName, selectionSource);
                }}
                placeholder="Nhập mã hoặc tên cổ phiếu, ví dụ 600519, AAPL"
                disabled={isAnalyzing}
                className={inputError ? 'border-danger/50' : undefined}
              />
              {inputError ? (
                <p className="absolute -bottom-4 left-0 text-xs text-danger">{inputError}</p>
              ) : null}
              {duplicateError ? (
                <p className="absolute -bottom-4 left-0 text-xs text-warning">{duplicateError}</p>
              ) : null}
            </div>
            <label className="flex flex-shrink-0 cursor-pointer items-center gap-1 text-xs text-secondary-text select-none">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              Gửi thông báo
            </label>
            <button
              type="button"
              onClick={() => handleSubmitAnalysis()}
              disabled={!query || isAnalyzing}
              className="btn-primary flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap"
            >
              {isAnalyzing ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang phân tích
                </>
              ) : (
                'Phân tích'
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="hidden min-h-0 w-64 shrink-0 flex-col overflow-hidden pl-4 pb-4 md:flex lg:w-72">
            {sidebarContent}
          </div>

          {sidebarOpen ? (
            <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
              <div className="absolute inset-0 home-mobile-overlay" />
              <div
                className="dashboard-card absolute bottom-0 left-0 top-0 flex w-72 flex-col overflow-hidden !rounded-none !rounded-r-xl p-3 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                {sidebarContent}
              </div>
            </div>
          ) : null}

          <section className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
            <Tabs
              value={mainTab}
              onValueChange={(v) => setMainTab(v as MainTab)}
              className="flex flex-1 min-h-0 flex-col gap-0"
            >
              {/* ── Tab bar ── */}
              <div className="shrink-0 border-b border-[var(--border-dim)] px-3 md:px-6">
                <TabsList className="h-auto gap-0 rounded-none bg-transparent p-0">
                  <TabsTrigger
                    value="recommendations"
                    className="flex items-center gap-1.5 rounded-none border-0 border-b-2 border-transparent px-3 py-2.5 text-xs font-semibold text-muted-text transition-colors data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Khuyến nghị hôm nay
                  </TabsTrigger>
                  <TabsTrigger
                    value="report"
                    className="flex items-center gap-1.5 rounded-none border-0 border-b-2 border-transparent px-3 py-2.5 text-xs font-semibold text-muted-text transition-colors data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Phân tích cổ phiếu
                    {selectedReport && (
                      <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                        {selectedReport.meta.stockCode.replace('VN:', '')}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ── Tab content ── */}
              <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto px-3 pb-4 md:px-6">
                {error ? (
                  <ApiErrorAlert error={error} className="mb-3 mt-3" onDismiss={clearError} />
                ) : null}

                {/* Tab: Khuyến nghị */}
                <TabsContent value="recommendations" className="mt-0">
                  <div className="max-w-4xl pt-3 pb-8">
                    <RecommendationsPanel
                      onAnalyzeStock={(stockCode) => {
                        const code = stockCode.replace(/^VN:/i, '');
                        setQuery(code);
                        handleSubmitAnalysis(stockCode);
                      }}
                    />
                  </div>
                </TabsContent>

                {/* Tab: Phân tích cổ phiếu */}
                <TabsContent value="report" className="mt-0">
                  {isLoadingReport ? (
                    <div className="flex h-full flex-col items-center justify-center">
                      <DashboardStateBlock title="Đang tải báo cáo..." loading />
                    </div>
                  ) : selectedReport ? (
                    <div className="max-w-4xl pt-3 pb-8">
                      <div className="mb-3 flex items-center justify-end gap-2 flex-wrap">
                        <Button
                          variant="home-action-ai"
                          size="sm"
                          disabled={selectedReport.meta.id === undefined}
                          onClick={handleAskFollowUp}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Hỏi thêm AI
                        </Button>
                        <Button
                          variant="home-action-report"
                          size="sm"
                          disabled={selectedReport.meta.id === undefined}
                          onClick={openMarkdownDrawer}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {reportText.fullReport}
                        </Button>
                      </div>
                      <div className="mb-3 dashboard-card p-3 h-[200px] md:h-[300px]">
                        <CandlestickChart
                          data={ohlcvData ?? []}
                          isLoading={isOhlcvLoading}
                          error={ohlcvError}
                          period={ohlcvPeriod}
                          stockName={selectedReport.meta.stockName ?? undefined}
                          onPeriodChange={setOhlcvPeriod}
                          onRetry={() => selectedStockCode && fetchOHLCV(selectedStockCode, ohlcvPeriod)}
                        />
                      </div>
                      <ReportSummary data={selectedReport} isHistory />
                      <StockNewsPanel
                        stockCode={selectedReport.meta.stockCode}
                        stockName={selectedReport.meta.stockName ?? undefined}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <DashboardStateBlock
                        title="Chưa có báo cáo"
                        description="Nhập mã cổ phiếu ở thanh tìm kiếm phía trên, hoặc chọn báo cáo lịch sử bên trái"
                        titleClassName="text-base font-medium text-foreground"
                        icon={(
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      />
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </section>
        </div>
      </div>

      {markdownDrawerOpen && selectedReport?.meta.id ? (
        <ReportMarkdown
          recordId={selectedReport.meta.id}
          stockName={selectedReport.meta.stockName || ''}
          stockCode={selectedReport.meta.stockCode}
          reportLanguage={reportLanguage}
          onClose={closeMarkdownDrawer}
        />
      ) : null}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Xóa lịch sử"
        message={
          selectedHistoryIds.length === 1
            ? 'Xác nhận xóa bản ghi lịch sử này? Sau khi xóa không thể khôi phục.'
            : `Xác nhận xóa ${selectedHistoryIds.length} bản ghi lịch sử đã chọn? Sau khi xóa không thể khôi phục.`
        }
        confirmText={isDeletingHistory ? 'Đang xóa...' : 'Xác nhận xóa'}
        cancelText="Hủy"
        isDanger={true}
        onConfirm={handleDeleteSelectedHistory}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default HomePage;
