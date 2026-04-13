import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts';
import { portfolioApi } from '../api/portfolio';
import type { ParsedApiError } from '../api/error';
import { getParsedApiError } from '../api/error';
import { ApiErrorAlert, Card, Badge, ConfirmDialog } from '../components/common';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import { toDateInputValue } from '../utils/format';
import { formatMoney } from '../utils/formatMoney';
import type {
  PortfolioAccountItem,
  PortfolioCashDirection,
  PortfolioCashLedgerListItem,
  PortfolioCorporateActionListItem,
  PortfolioCorporateActionType,
  PortfolioCostMethod,
  PortfolioFxRefreshResponse,
  PortfolioImportBrokerItem,
  PortfolioImportCommitResponse,
  PortfolioImportParseResponse,
  PortfolioPositionItem,
  PortfolioRiskResponse,
  PortfolioSide,
  PortfolioSnapshotResponse,
  PortfolioTradeListItem,
} from '../types/portfolio';

const PIE_COLORS = ['#00d4ff', '#00ff88', '#ffaa00', '#ff7a45', '#7f8cff', '#ff4466'];
const DEFAULT_PAGE_SIZE = 20;
const FALLBACK_BROKERS: PortfolioImportBrokerItem[] = [
  { broker: 'tcbs', aliases: [], displayName: 'TCBS (Techcombank)' },
  { broker: 'ssi', aliases: [], displayName: 'SSI Securities' },
  { broker: 'vps', aliases: [], displayName: 'VPS Securities' },
  { broker: 'vcsc', aliases: [], displayName: 'VCSC (Viet Capital)' },
  { broker: 'hsc', aliases: [], displayName: 'HSC Securities' },
];

type AccountOption = 'all' | number;
type EventType = 'trade' | 'cash' | 'corporate';

type FlatPosition = PortfolioPositionItem & {
  accountId: number;
  accountName: string;
};

type PendingDelete =
  | { eventType: 'trade'; id: number; message: string }
  | { eventType: 'cash'; id: number; message: string }
  | { eventType: 'corporate'; id: number; message: string };

type FxRefreshFeedback = {
  tone: 'neutral' | 'success' | 'warning';
  text: string;
};

type FxRefreshContext = {
  viewKey: string;
  requestId: number;
};

function getTodayIso(): string {
  return toDateInputValue(new Date());
}


function formatPct(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '--';
  return `${value.toFixed(2)}%`;
}

function formatSideLabel(value: PortfolioSide): string {
  return value === 'buy' ? 'Mua' : 'Bán';
}

function formatCashDirectionLabel(value: PortfolioCashDirection): string {
  return value === 'in' ? 'Nạp tiền' : 'Rút tiền';
}

function formatCorporateActionLabel(value: PortfolioCorporateActionType): string {
  return value === 'cash_dividend' ? 'Cổ tức tiền mặt' : 'Tách/gộp cổ phiếu';
}

function formatBrokerLabel(value: string, displayName?: string): string {
  if (displayName && displayName.trim()) return `${value} — ${displayName.trim()}`;
  return value;
}

function buildFxRefreshFeedback(data: PortfolioFxRefreshResponse): FxRefreshFeedback {
  if (data.refreshEnabled === false) {
    return {
      tone: 'neutral',
      text: 'Làm mới tỷ giá trực tuyến đã bị tắt.',
    };
  }

  if (data.pairCount === 0) {
    return {
      tone: 'neutral',
      text: 'Không có cặp tỷ giá nào cần làm mới trong phạm vi hiện tại.',
    };
  }

  if (data.updatedCount > 0 && data.staleCount === 0 && data.errorCount === 0) {
    return {
      tone: 'success',
      text: `Tỷ giá đã được làm mới, cập nhật ${data.updatedCount} cặp.`,
    };
  }

  const summary = `Cập nhật ${data.updatedCount} cặp, còn lỗi thời ${data.staleCount} cặp, thất bại ${data.errorCount} cặp.`;
  if (data.staleCount > 0) {
    return {
      tone: 'warning',
      text: `Đã làm mới nhưng một số cặp vẫn dùng tỷ giá dự phòng. ${summary}`,
    };
  }

  return {
    tone: 'warning',
    text: `Làm mới chưa hoàn toàn thành công. ${summary}`,
  };
}

const PortfolioPage: React.FC = () => {
  // Set page title
  useEffect(() => {
    document.title = 'Danh mục - DSA';
  }, []);

  const [accounts, setAccounts] = useState<PortfolioAccountItem[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountOption>('all');
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountCreating, setAccountCreating] = useState(false);
  const [accountCreateError, setAccountCreateError] = useState<string | null>(null);
  const [accountCreateSuccess, setAccountCreateSuccess] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: '',
    broker: 'Demo',
    market: 'vn' as 'cn' | 'hk' | 'us' | 'vn',
    baseCurrency: 'VND',
  });
  const [costMethod, setCostMethod] = useState<PortfolioCostMethod>('fifo');
  const [snapshot, setSnapshot] = useState<PortfolioSnapshotResponse | null>(null);
  const [risk, setRisk] = useState<PortfolioRiskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fxRefreshing, setFxRefreshing] = useState(false);
  const [fxRefreshFeedback, setFxRefreshFeedback] = useState<FxRefreshFeedback | null>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [riskWarning, setRiskWarning] = useState<string | null>(null);
  const [writeWarning, setWriteWarning] = useState<string | null>(null);

  const [brokers, setBrokers] = useState<PortfolioImportBrokerItem[]>([]);
  const [selectedBroker, setSelectedBroker] = useState('tcbs');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDryRun, setCsvDryRun] = useState(true);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvCommitting, setCsvCommitting] = useState(false);
  const [csvParseResult, setCsvParseResult] = useState<PortfolioImportParseResponse | null>(null);
  const [csvCommitResult, setCsvCommitResult] = useState<PortfolioImportCommitResponse | null>(null);
  const [brokerLoadWarning, setBrokerLoadWarning] = useState<string | null>(null);

  const [eventType, setEventType] = useState<EventType>('trade');
  const [eventDateFrom, setEventDateFrom] = useState('');
  const [eventDateTo, setEventDateTo] = useState('');
  const [eventSymbol, setEventSymbol] = useState('');
  const [eventSide, setEventSide] = useState<'' | PortfolioSide>('');
  const [eventDirection, setEventDirection] = useState<'' | PortfolioCashDirection>('');
  const [eventActionType, setEventActionType] = useState<'' | PortfolioCorporateActionType>('');
  const [eventPage, setEventPage] = useState(1);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventLoading, setEventLoading] = useState(false);
  const [tradeEvents, setTradeEvents] = useState<PortfolioTradeListItem[]>([]);
  const [cashEvents, setCashEvents] = useState<PortfolioCashLedgerListItem[]>([]);
  const [corporateEvents, setCorporateEvents] = useState<PortfolioCorporateActionListItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [tradeForm, setTradeForm] = useState({
    symbol: '',
    tradeDate: getTodayIso(),
    side: 'buy' as PortfolioSide,
    quantity: '',
    price: '',
    fee: '',
    tax: '',
    tradeUid: '',
    note: '',
  });
  const [cashForm, setCashForm] = useState({
    eventDate: getTodayIso(),
    direction: 'in' as PortfolioCashDirection,
    amount: '',
    currency: '',
    note: '',
  });
  const [corpForm, setCorpForm] = useState({
    symbol: '',
    effectiveDate: getTodayIso(),
    actionType: 'cash_dividend' as PortfolioCorporateActionType,
    cashDividendPerShare: '',
    splitRatio: '',
    note: '',
  });

  const queryAccountId = selectedAccount === 'all' ? undefined : selectedAccount;
  const refreshViewKey = `${selectedAccount === 'all' ? 'all' : `account:${selectedAccount}`}:cost:${costMethod}`;
  const refreshContextRef = useRef<FxRefreshContext>({ viewKey: refreshViewKey, requestId: 0 });
  const hasAccounts = accounts.length > 0;
  const writableAccount = selectedAccount === 'all' ? undefined : accounts.find((item) => item.id === selectedAccount);
  const writableAccountId = writableAccount?.id;
  const writeBlocked = !writableAccountId;
  const totalEventPages = Math.max(1, Math.ceil(eventTotal / DEFAULT_PAGE_SIZE));
  const currentEventCount = eventType === 'trade'
    ? tradeEvents.length
    : eventType === 'cash'
      ? cashEvents.length
      : corporateEvents.length;

  const isActiveRefreshContext = (requestedViewKey: string, requestedRequestId: number) => {
    return (
      refreshContextRef.current.viewKey === requestedViewKey
      && refreshContextRef.current.requestId === requestedRequestId
    );
  };

  const loadAccounts = useCallback(async () => {
    try {
      const response = await portfolioApi.getAccounts(false);
      const items = response.accounts || [];
      setAccounts(items);
      setSelectedAccount((prev) => {
        if (items.length === 0) return 'all';
        if (prev !== 'all' && !items.some((item) => item.id === prev)) return items[0].id;
        return prev;
      });
      if (items.length === 0) setShowCreateAccount(true);
    } catch (err) {
      setError(getParsedApiError(err));
    }
  }, []);

  const loadBrokers = useCallback(async () => {
    try {
      const response = await portfolioApi.listImportBrokers();
      const brokerItems = response.brokers || [];
      if (brokerItems.length === 0) {
        setBrokers(FALLBACK_BROKERS);
        setBrokerLoadWarning('Danh sách môi giới trả về rỗng, đã dùng danh sách mặc định (TCBS/SSI/VPS).');
        if (!FALLBACK_BROKERS.some((item) => item.broker === selectedBroker)) {
          setSelectedBroker(FALLBACK_BROKERS[0].broker);
        }
        return;
      }
      setBrokers(brokerItems);
      setBrokerLoadWarning(null);
      if (!brokerItems.some((item) => item.broker === selectedBroker)) {
        setSelectedBroker(brokerItems[0].broker);
      }
    } catch {
      setBrokers(FALLBACK_BROKERS);
      setBrokerLoadWarning('Không thể tải danh sách môi giới, đã dùng danh sách mặc định (TCBS/SSI/VPS).');
      if (!FALLBACK_BROKERS.some((item) => item.broker === selectedBroker)) {
        setSelectedBroker(FALLBACK_BROKERS[0].broker);
      }
    }
  }, [selectedBroker]);

  const loadSnapshotAndRisk = useCallback(async () => {
    setIsLoading(true);
    setRiskWarning(null);
    try {
      const snapshotData = await portfolioApi.getSnapshot({
        accountId: queryAccountId,
        costMethod,
      });
      setSnapshot(snapshotData);
      setError(null);

      try {
        const riskData = await portfolioApi.getRisk({
          accountId: queryAccountId,
          costMethod,
        });
        setRisk(riskData);
      } catch (riskErr) {
        setRisk(null);
        const parsed = getParsedApiError(riskErr);
        setRiskWarning(parsed.message || 'Không thể tải dữ liệu rủi ro, chỉ hiển thị dữ liệu ảnh chụp.');
      }
    } catch (err) {
      setSnapshot(null);
      setRisk(null);
      setError(getParsedApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [queryAccountId, costMethod]);

  const loadEventsPage = useCallback(async (page: number) => {
    setEventLoading(true);
    try {
      if (eventType === 'trade') {
        const response = await portfolioApi.listTrades({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          symbol: eventSymbol || undefined,
          side: eventSide || undefined,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
        });
        setTradeEvents(response.items || []);
        setEventTotal(response.total || 0);
      } else if (eventType === 'cash') {
        const response = await portfolioApi.listCashLedger({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          direction: eventDirection || undefined,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
        });
        setCashEvents(response.items || []);
        setEventTotal(response.total || 0);
      } else {
        const response = await portfolioApi.listCorporateActions({
          accountId: queryAccountId,
          dateFrom: eventDateFrom || undefined,
          dateTo: eventDateTo || undefined,
          symbol: eventSymbol || undefined,
          actionType: eventActionType || undefined,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
        });
        setCorporateEvents(response.items || []);
        setEventTotal(response.total || 0);
      }
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setEventLoading(false);
    }
  }, [
    eventActionType,
    eventDateFrom,
    eventDateTo,
    eventDirection,
    eventSide,
    eventSymbol,
    eventType,
    queryAccountId,
  ]);

  const loadEvents = useCallback(async () => {
    await loadEventsPage(eventPage);
  }, [eventPage, loadEventsPage]);

  const refreshPortfolioData = useCallback(async (page = eventPage) => {
    await Promise.all([loadSnapshotAndRisk(), loadEventsPage(page)]);
  }, [eventPage, loadEventsPage, loadSnapshotAndRisk]);

  useEffect(() => {
    void loadAccounts();
    void loadBrokers();
  }, [loadAccounts, loadBrokers]);

  useEffect(() => {
    void loadSnapshotAndRisk();
  }, [loadSnapshotAndRisk]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    refreshContextRef.current = {
      viewKey: refreshViewKey,
      requestId: refreshContextRef.current.requestId + 1,
    };
    setFxRefreshing(false);
    setFxRefreshFeedback(null);
  }, [refreshViewKey]);

  useEffect(() => {
    setEventPage(1);
  }, [eventType, queryAccountId, eventDateFrom, eventDateTo, eventSymbol, eventSide, eventDirection, eventActionType]);

  useEffect(() => {
    if (!writeBlocked) {
      setWriteWarning(null);
    }
  }, [writeBlocked]);

  const positionRows: FlatPosition[] = useMemo(() => {
    if (!snapshot) return [];
    const rows: FlatPosition[] = [];
    for (const account of snapshot.accounts || []) {
      for (const position of account.positions || []) {
        rows.push({
          ...position,
          accountId: account.accountId,
          accountName: account.accountName,
        });
      }
    }
    rows.sort((a, b) => Number(b.marketValueBase || 0) - Number(a.marketValueBase || 0));
    return rows;
  }, [snapshot]);

  const sectorPieData = useMemo(() => {
    const sectors = risk?.sectorConcentration?.topSectors || [];
    return sectors
      .slice(0, 6)
      .map((item) => ({
        name: item.sector,
        value: Number(item.weightPct || 0),
      }))
      .filter((item) => item.value > 0);
  }, [risk]);

  const positionFallbackPieData = useMemo(() => {
    if (!risk?.concentration?.topPositions?.length) {
      return [];
    }
    return risk.concentration.topPositions
      .slice(0, 6)
      .map((item) => ({
        name: item.symbol,
        value: Number(item.weightPct || 0),
      }))
      .filter((item) => item.value > 0);
  }, [risk]);

  const concentrationPieData = sectorPieData.length > 0 ? sectorPieData : positionFallbackPieData;
  const concentrationMode = sectorPieData.length > 0 ? 'sector' : 'position';

  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writableAccountId) {
      setWriteWarning('Vui lòng chọn tài khoản cụ thể trước khi nhập liệu hoặc nhập CSV.');
      return;
    }
    try {
      setWriteWarning(null);
      await portfolioApi.createTrade({
        accountId: writableAccountId,
        symbol: tradeForm.symbol,
        tradeDate: tradeForm.tradeDate,
        side: tradeForm.side,
        quantity: Number(tradeForm.quantity),
        price: Number(tradeForm.price),
        fee: Number(tradeForm.fee || 0),
        tax: Number(tradeForm.tax || 0),
        tradeUid: tradeForm.tradeUid || undefined,
        note: tradeForm.note || undefined,
      });
      await refreshPortfolioData();
      setTradeForm((prev) => ({ ...prev, symbol: '', tradeUid: '', note: '' }));
    } catch (err) {
      setError(getParsedApiError(err));
    }
  };

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writableAccountId) {
      setWriteWarning('Vui lòng chọn tài khoản cụ thể trước khi nhập liệu hoặc nhập CSV.');
      return;
    }
    try {
      setWriteWarning(null);
      await portfolioApi.createCashLedger({
        accountId: writableAccountId,
        eventDate: cashForm.eventDate,
        direction: cashForm.direction,
        amount: Number(cashForm.amount),
        currency: cashForm.currency || undefined,
        note: cashForm.note || undefined,
      });
      await refreshPortfolioData();
      setCashForm((prev) => ({ ...prev, note: '' }));
    } catch (err) {
      setError(getParsedApiError(err));
    }
  };

  const handleCorporateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writableAccountId) {
      setWriteWarning('Vui lòng chọn tài khoản cụ thể trước khi nhập liệu hoặc nhập CSV.');
      return;
    }
    try {
      setWriteWarning(null);
      await portfolioApi.createCorporateAction({
        accountId: writableAccountId,
        symbol: corpForm.symbol,
        effectiveDate: corpForm.effectiveDate,
        actionType: corpForm.actionType,
        cashDividendPerShare: corpForm.cashDividendPerShare ? Number(corpForm.cashDividendPerShare) : undefined,
        splitRatio: corpForm.splitRatio ? Number(corpForm.splitRatio) : undefined,
        note: corpForm.note || undefined,
      });
      await refreshPortfolioData();
      setCorpForm((prev) => ({ ...prev, symbol: '', note: '' }));
    } catch (err) {
      setError(getParsedApiError(err));
    }
  };

  const handleParseCsv = async () => {
    if (!csvFile) return;
    try {
      setCsvParsing(true);
      const parsed = await portfolioApi.parseCsvImport(selectedBroker, csvFile);
      setCsvParseResult(parsed);
      setCsvCommitResult(null);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setCsvParsing(false);
    }
  };

  const handleCommitCsv = async () => {
    if (!csvFile) return;
    if (!writableAccountId) {
      setWriteWarning('Vui lòng chọn tài khoản cụ thể trước khi nhập liệu hoặc nhập CSV.');
      return;
    }
    try {
      setWriteWarning(null);
      setCsvCommitting(true);
      const committed = await portfolioApi.commitCsvImport(writableAccountId, selectedBroker, csvFile, csvDryRun);
      setCsvCommitResult(committed);
      if (!csvDryRun) {
        await refreshPortfolioData();
      }
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setCsvCommitting(false);
    }
  };

  const openDeleteDialog = (item: PendingDelete) => {
    if (!writableAccountId) {
      setWriteWarning('Vui lòng chọn tài khoản cụ thể trước khi xóa giao dịch.');
      return;
    }
    setPendingDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deleteLoading) return;
    if (!writableAccountId) {
      setWriteWarning('Vui lòng chọn tài khoản cụ thể trước khi xóa giao dịch.');
      setPendingDelete(null);
      return;
    }

    const nextPage = currentEventCount === 1 && eventPage > 1 ? eventPage - 1 : eventPage;
    try {
      setDeleteLoading(true);
      setWriteWarning(null);
      if (pendingDelete.eventType === 'trade') {
        await portfolioApi.deleteTrade(pendingDelete.id);
      } else if (pendingDelete.eventType === 'cash') {
        await portfolioApi.deleteCashLedger(pendingDelete.id);
      } else {
        await portfolioApi.deleteCorporateAction(pendingDelete.id);
      }
      setPendingDelete(null);
      if (nextPage !== eventPage) {
        setEventPage(nextPage);
      }
      await refreshPortfolioData(nextPage);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = accountForm.name.trim();
    if (!name) {
      setAccountCreateError('Tên tài khoản không được để trống.');
      setAccountCreateSuccess(null);
      return;
    }
    try {
      setAccountCreating(true);
      setAccountCreateError(null);
      setAccountCreateSuccess(null);
      const created = await portfolioApi.createAccount({
        name,
        broker: accountForm.broker.trim() || undefined,
        market: accountForm.market,
        baseCurrency: accountForm.baseCurrency.trim() || 'VND',
      });
      await loadAccounts();
      setSelectedAccount(created.id);
      setShowCreateAccount(false);
      setWriteWarning(null);
      setAccountForm({
        name: '',
        broker: 'Demo',
        market: accountForm.market,
        baseCurrency: accountForm.baseCurrency,
      });
      setAccountCreateSuccess('Tạo tài khoản thành công, đã tự động chuyển sang tài khoản mới.');
    } catch (err) {
      const parsed = getParsedApiError(err);
      setAccountCreateError(parsed.message || 'Tạo tài khoản thất bại, vui lòng thử lại.');
      setAccountCreateSuccess(null);
    } finally {
      setAccountCreating(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadAccounts(), loadSnapshotAndRisk(), loadEvents(), loadBrokers()]);
  };

  const reloadSnapshotAndRiskForScope = useCallback(async (
    requestedViewKey: string,
    requestedRequestId: number,
    requestedAccountId: number | undefined,
    requestedCostMethod: PortfolioCostMethod,
  ): Promise<boolean> => {
    if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
      return false;
    }

    setRiskWarning(null);

    try {
      const snapshotData = await portfolioApi.getSnapshot({
        accountId: requestedAccountId,
        costMethod: requestedCostMethod,
      });
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return false;
      }
      setSnapshot(snapshotData);
      setError(null);

      try {
        const riskData = await portfolioApi.getRisk({
          accountId: requestedAccountId,
          costMethod: requestedCostMethod,
        });
        if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
          return false;
        }
        setRisk(riskData);
        setRiskWarning(null);
      } catch (riskErr) {
        if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
          return false;
        }
        setRisk(null);
        const parsed = getParsedApiError(riskErr);
        setRiskWarning(parsed.message || 'Không thể tải dữ liệu rủi ro, chỉ hiển thị dữ liệu ảnh chụp.');
      }
      return true;
    } catch (err) {
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return false;
      }
      setSnapshot(null);
      setRisk(null);
      setError(getParsedApiError(err));
      return false;
    }
  }, []);

  const handleRefreshFx = async () => {
    if (!hasAccounts || isLoading || fxRefreshing) {
      return;
    }

    const requestedViewKey = refreshViewKey;
    const requestedAccountId = queryAccountId;
    const requestedCostMethod = costMethod;
    const requestedRequestId = refreshContextRef.current.requestId + 1;
    refreshContextRef.current = {
      viewKey: requestedViewKey,
      requestId: requestedRequestId,
    };

    try {
      setFxRefreshing(true);
      setFxRefreshFeedback(null);
      const result = await portfolioApi.refreshFx({
        accountId: requestedAccountId,
      });
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return;
      }
      const reloaded = await reloadSnapshotAndRiskForScope(
        requestedViewKey,
        requestedRequestId,
        requestedAccountId,
        requestedCostMethod,
      );
      if (!reloaded || !isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return;
      }
      setFxRefreshFeedback(buildFxRefreshFeedback(result));
    } catch (err) {
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        return;
      }
      setError(getParsedApiError(err));
    } finally {
      if (isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        setFxRefreshing(false);
      }
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-4">
      <section className="space-y-3">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Quản lý danh mục</h1>
          <p className="text-xs md:text-sm text-secondary">
            Ảnh chụp danh mục, nhập tay, nhập CSV và phân tích rủi ro (hỗ trợ toàn danh mục / từng tài khoản)
          </p>
        </div>
        {hasAccounts ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px_280px] gap-2 items-end">
              <div>
                <p className="text-xs text-secondary mb-1">Tài khoản</p>
                <select
                  value={String(selectedAccount)}
                  onChange={(e) => setSelectedAccount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="input-terminal text-sm w-full"
                >
                  <option value="all">Tất cả tài khoản</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} (#{account.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-secondary mb-1">Phương pháp giá vốn</p>
                <select
                  value={costMethod}
                  onChange={(e) => setCostMethod(e.target.value as PortfolioCostMethod)}
                  className="input-terminal text-sm w-full"
                >
                  <option value="fifo">Nhập trước xuất trước (FIFO)</option>
                  <option value="avg">Giá vốn trung bình (AVG)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary text-sm flex-1"
                  onClick={() => {
                    setShowCreateAccount((prev) => !prev);
                    setAccountCreateError(null);
                    setAccountCreateSuccess(null);
                  }}
                >
                  {showCreateAccount ? 'Thu gọn' : 'Tạo tài khoản'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={isLoading || fxRefreshing}
                  className="btn-secondary text-sm flex-1"
                >
                  {isLoading ? 'Đang làm mới...' : 'Làm mới'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-amber-300 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 inline-block">
            Chưa có tài khoản nào. Vui lòng tạo tài khoản trước khi nhập giao dịch hoặc nhập CSV.
          </div>
        )}
      </section>

      {error ? <ApiErrorAlert error={error} onDismiss={() => setError(null)} /> : null}
      {riskWarning ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
          Cảnh báo rủi ro: {riskWarning}
        </div>
      ) : null}
      {writeWarning ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
          Lưu ý: {writeWarning}
        </div>
      ) : null}

      {(showCreateAccount || !hasAccounts) ? (
        <Card padding="md">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Tạo tài khoản mới</h2>
            {hasAccounts ? (
              <button
                type="button"
                className="btn-secondary text-xs px-3 py-1"
                onClick={() => {
                  setShowCreateAccount(false);
                  setAccountCreateError(null);
                  setAccountCreateSuccess(null);
                }}
              >
                Thu gọn
              </button>
            ) : (
              <span className="text-xs text-secondary">Sau khi tạo sẽ tự động chuyển sang tài khoản mới</span>
            )}
          </div>
          {accountCreateError ? (
            <div className="mt-2 text-xs text-red-300 rounded-lg border border-red-400/30 bg-red-400/10 px-2 py-1">
              {accountCreateError}
            </div>
          ) : null}
          {accountCreateSuccess ? (
            <div className="mt-2 text-xs text-emerald-300 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1">
              {accountCreateSuccess}
            </div>
          ) : null}
          <form className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2" onSubmit={handleCreateAccount}>
            <input
              className="input-terminal text-sm md:col-span-2"
              placeholder="Tên tài khoản (bắt buộc)"
              value={accountForm.name}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="input-terminal text-sm"
              placeholder="Môi giới (tùy chọn, VD: TCBS/SSI)"
              value={accountForm.broker}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, broker: e.target.value }))}
            />
            <input
              className="input-terminal text-sm"
              placeholder="Tiền tệ cơ sở (VD: VND/USD)"
              value={accountForm.baseCurrency}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, baseCurrency: e.target.value.toUpperCase() }))}
            />
            <select
              className="input-terminal text-sm"
              value={accountForm.market}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, market: e.target.value as 'cn' | 'hk' | 'us' | 'vn' }))}
            >
              <option value="vn">Thị trường: Việt Nam (HOSE/HNX)</option>
              <option value="us">Thị trường: Mỹ (NYSE/NASDAQ)</option>
              <option value="hk">Thị trường: Hồng Kông (HKEX)</option>
              <option value="cn">Thị trường: Trung Quốc (A-share)</option>
            </select>
            <button type="submit" className="btn-secondary text-sm" disabled={accountCreating}>
              {accountCreating ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </form>
        </Card>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card variant="gradient" padding="md">
          <p className="text-xs text-secondary">Tổng vốn chủ sở hữu</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatMoney(snapshot?.totalEquity, snapshot?.currency || 'VND')}</p>
        </Card>
        <Card variant="gradient" padding="md">
          <p className="text-xs text-secondary">Tổng giá trị thị trường</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatMoney(snapshot?.totalMarketValue, snapshot?.currency || 'VND')}</p>
        </Card>
        <Card variant="gradient" padding="md">
          <p className="text-xs text-secondary">Tổng tiền mặt</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatMoney(snapshot?.totalCash, snapshot?.currency || 'VND')}</p>
        </Card>
        <Card variant="gradient" padding="md">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-secondary">Trạng thái tỷ giá</p>
            <button
              type="button"
              className="btn-secondary !px-3 !py-1 !text-xs shrink-0"
              onClick={() => void handleRefreshFx()}
              disabled={!hasAccounts || isLoading || fxRefreshing}
            >
              {fxRefreshing ? 'Đang làm mới...' : 'Làm mới tỷ giá'}
            </button>
          </div>
          <div className="mt-2">{snapshot?.fxStale ? <Badge variant="warning">Lỗi thời</Badge> : <Badge variant="success">Mới nhất</Badge>}</div>
          {fxRefreshFeedback ? (
            <p
              className={`mt-2 text-xs ${
                fxRefreshFeedback.tone === 'success'
                  ? 'text-emerald-200'
                  : fxRefreshFeedback.tone === 'warning'
                    ? 'text-amber-100'
                    : 'text-secondary'
              }`}
            >
              {fxRefreshFeedback.text}
            </p>
          ) : null}
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="xl:col-span-2" padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Chi tiết vị thế</h2>
            <span className="text-xs text-secondary">{positionRows.length} mã</span>
          </div>
          {positionRows.length === 0 ? (
            <p className="text-sm text-secondary-text py-6 text-center">Chưa có vị thế nào</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-xs">Tài khoản</TableHead>
                  <TableHead className="text-xs">Mã CP</TableHead>
                  <TableHead className="text-xs text-right">SL</TableHead>
                  <TableHead className="text-xs text-right">Giá vốn</TableHead>
                  <TableHead className="text-xs text-right">Giá TT</TableHead>
                  <TableHead className="text-xs text-right">Giá trị TT</TableHead>
                  <TableHead className="text-xs text-right min-w-[120px]">Lãi/lỗ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positionRows.map((row) => {
                  const isGain = row.unrealizedPnlBase >= 0;
                  const pnlPct = row.avgCost > 0
                    ? ((row.lastPrice - row.avgCost) / row.avgCost) * 100
                    : 0;
                  return (
                    <TableRow
                      key={`${row.accountId}-${row.symbol}-${row.market}`}
                      className="border-border/30"
                    >
                      <TableCell className="text-xs text-secondary-text">{row.accountName}</TableCell>
                      <TableCell className="font-mono font-medium text-foreground">{row.symbol}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.avgCost.toFixed(4)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.lastPrice.toFixed(4)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.marketValueBase, row.valuationCurrency)}</TableCell>
                      <TableCell className="text-right min-w-[120px]">
                        <div className="flex flex-col items-end gap-1">
                          <span className={isGain ? 'text-success font-medium' : 'text-danger font-medium'}>
                            {isGain ? '+' : ''}{formatMoney(row.unrealizedPnlBase, row.valuationCurrency)}
                          </span>
                          <div className="flex items-center gap-1.5 w-full justify-end">
                            <span className={`text-[10px] ${isGain ? 'text-success' : 'text-danger'}`}>
                              {isGain ? '+' : ''}{pnlPct.toFixed(2)}%
                            </span>
                            <Progress
                              value={Math.min(Math.abs(pnlPct), 100)}
                              className={`h-1 w-12 ${isGain ? '[&>[data-slot=progress-indicator]]:bg-success' : '[&>[data-slot=progress-indicator]]:bg-danger'}`}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card padding="md">
          <h2 className="text-sm font-semibold text-foreground mb-3">{concentrationMode === 'sector' ? 'Phân bổ theo ngành' : 'Chưa có dữ liệu ngành, hiển thị theo từng mã cổ phiếu'}</h2>
          {concentrationPieData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={concentrationPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                    {concentrationPieData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted py-8 text-center">Chưa có dữ liệu phân bổ</p>
          )}
          <div className="mt-3 text-xs text-secondary space-y-1">
            <div>Phạm vi: {concentrationMode === 'sector' ? 'Theo ngành' : 'Theo mã cổ phiếu (dự phòng)'}</div>
            <div>Cảnh báo tập trung ngành: {risk?.sectorConcentration?.alert ? 'Có' : 'Không'}</div>
            <div>Tỷ trọng Top 1: {formatPct(risk?.sectorConcentration?.topWeightPct ?? risk?.concentration?.topWeightPct)}</div>
          </div>
        </Card>
      </section>

      {writeBlocked && hasAccounts ? (
        <div className="text-xs text-amber-300 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
          Đang ở chế độ xem “Tất cả tài khoản”. Để tránh ghi nhầm, hãy chọn một tài khoản cụ thể trước khi nhập thủ công hoặc nhập CSV.
        </div>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-2">Theo dõi Drawdown</h3>
          <div className="text-xs text-secondary space-y-1">
            <div>Drawdown tối đa: {formatPct(risk?.drawdown?.maxDrawdownPct)}</div>
            <div>Drawdown hiện tại: {formatPct(risk?.drawdown?.currentDrawdownPct)}</div>
            <div>Cảnh báo: {risk?.drawdown?.alert ? 'Có' : 'Không'}</div>
          </div>
        </Card>
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-2">Cảnh báo gần cắt lỗ</h3>
          <div className="text-xs text-secondary space-y-1">
            <div>Đã kích hoạt: {risk?.stopLoss?.triggeredCount ?? 0}</div>
            <div>Gần ngưỡng: {risk?.stopLoss?.nearCount ?? 0}</div>
            <div>Cảnh báo: {risk?.stopLoss?.nearAlert ? 'Có' : 'Không'}</div>
          </div>
        </Card>
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-2">Thông tin danh mục</h3>
          <div className="text-xs text-secondary space-y-1">
            <div>Số tài khoản: {snapshot?.accountCount ?? 0}</div>
            <div>Tiền tệ: {snapshot?.currency || 'VND'}</div>
            <div>Phương pháp giá vốn: {(snapshot?.costMethod || costMethod).toUpperCase()}</div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-3">Nhập thủ công: Giao dịch</h3>
          <form className="space-y-2" onSubmit={handleTradeSubmit}>
            <input className="input-terminal w-full text-sm" placeholder="Mã cổ phiếu (ví dụ VCB)" value={tradeForm.symbol}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, symbol: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-terminal text-sm" type="date" value={tradeForm.tradeDate}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, tradeDate: e.target.value }))} required />
              <select className="input-terminal text-sm" value={tradeForm.side}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, side: e.target.value as PortfolioSide }))}>
                <option value="buy">Mua</option>
                <option value="sell">Bán</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input-terminal text-sm" type="number" min="0" step="0.0001" placeholder="Số lượng (bắt buộc)" value={tradeForm.quantity}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, quantity: e.target.value }))} required />
              <input className="input-terminal text-sm" type="number" min="0" step="0.0001" placeholder="Giá khớp (bắt buộc)" value={tradeForm.price}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, price: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input-terminal text-sm" type="number" min="0" step="0.0001" placeholder="Phí giao dịch (tuỳ chọn)" value={tradeForm.fee}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, fee: e.target.value }))} />
              <input className="input-terminal text-sm" type="number" min="0" step="0.0001" placeholder="Thuế (tuỳ chọn)" value={tradeForm.tax}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, tax: e.target.value }))} />
            </div>
            <p className="text-xs text-secondary">Phí và thuế có thể để trống, hệ thống sẽ tính là 0.</p>
            <button type="submit" className="btn-secondary w-full" disabled={!writableAccountId}>Gửi giao dịch</button>
          </form>
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-3">Nhập thủ công: Dòng tiền</h3>
          <form className="space-y-2" onSubmit={handleCashSubmit}>
            <div className="grid grid-cols-2 gap-2">
              <input className="input-terminal text-sm" type="date" value={cashForm.eventDate}
                onChange={(e) => setCashForm((prev) => ({ ...prev, eventDate: e.target.value }))} required />
              <select className="input-terminal text-sm" value={cashForm.direction}
                onChange={(e) => setCashForm((prev) => ({ ...prev, direction: e.target.value as PortfolioCashDirection }))}>
                <option value="in">Nạp tiền</option>
                <option value="out">Rút tiền</option>
              </select>
            </div>
            <input className="input-terminal w-full text-sm" type="number" min="0" step="0.0001" placeholder="Số tiền"
              value={cashForm.amount} onChange={(e) => setCashForm((prev) => ({ ...prev, amount: e.target.value }))} required />
            <input className="input-terminal w-full text-sm" placeholder={`Tiền tệ (tuỳ chọn, mặc định ${writableAccount?.baseCurrency || 'tiền tệ tài khoản'})`} value={cashForm.currency}
              onChange={(e) => setCashForm((prev) => ({ ...prev, currency: e.target.value }))} />
            <button type="submit" className="btn-secondary w-full" disabled={!writableAccountId}>Gửi dòng tiền</button>
          </form>
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-3">Nhập thủ công: Sự kiện doanh nghiệp</h3>
          <form className="space-y-2" onSubmit={handleCorporateSubmit}>
            <input className="input-terminal w-full text-sm" placeholder="Mã cổ phiếu" value={corpForm.symbol}
              onChange={(e) => setCorpForm((prev) => ({ ...prev, symbol: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-terminal text-sm" type="date" value={corpForm.effectiveDate}
                onChange={(e) => setCorpForm((prev) => ({ ...prev, effectiveDate: e.target.value }))} required />
              <select className="input-terminal text-sm" value={corpForm.actionType}
                onChange={(e) => setCorpForm((prev) => ({ ...prev, actionType: e.target.value as PortfolioCorporateActionType }))}>
                <option value="cash_dividend">Cổ tức tiền mặt</option>
                <option value="split_adjustment">Tách/gộp cổ phiếu</option>
              </select>
            </div>
            {corpForm.actionType === 'cash_dividend' ? (
              <input className="input-terminal w-full text-sm" type="number" min="0" step="0.000001" placeholder="Cổ tức mỗi cổ phiếu"
                value={corpForm.cashDividendPerShare}
                onChange={(e) => setCorpForm((prev) => ({ ...prev, cashDividendPerShare: e.target.value, splitRatio: '' }))} required />
            ) : (
              <input className="input-terminal w-full text-sm" type="number" min="0" step="0.000001" placeholder="Tỷ lệ tách/gộp"
                value={corpForm.splitRatio}
                onChange={(e) => setCorpForm((prev) => ({ ...prev, splitRatio: e.target.value, cashDividendPerShare: '' }))} required />
            )}
            <button type="submit" className="btn-secondary w-full" disabled={!writableAccountId}>Gửi sự kiện doanh nghiệp</button>
          </form>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-3">Nhập CSV từ công ty chứng khoán</h3>
          <div className="space-y-2">
            {brokerLoadWarning ? (
              <div className="text-xs text-amber-300 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1">
                {brokerLoadWarning}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <select className="input-terminal text-sm" value={selectedBroker} onChange={(e) => setSelectedBroker(e.target.value)}>
                {brokers.length > 0 ? (
                  brokers.map((item) => <option key={item.broker} value={item.broker}>{formatBrokerLabel(item.broker, item.displayName)}</option>)
                ) : (
                  <option value="tcbs">TCBS</option>
                )}
              </select>
              <label className="input-terminal text-sm flex items-center justify-center cursor-pointer">
                Chọn file CSV
                <input type="file" accept=".csv" className="hidden"
                  onChange={(e) => setCsvFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
              </label>
            </div>
            <div className="flex items-center gap-2 text-xs text-secondary">
              <input id="csv-dry-run" type="checkbox" checked={csvDryRun} onChange={(e) => setCsvDryRun(e.target.checked)} />
              <label htmlFor="csv-dry-run">Chỉ thử nghiệm (không lưu)</label>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" disabled={!csvFile || csvParsing} onClick={() => void handleParseCsv()}>
                {csvParsing ? 'Đang phân tích...' : 'Phân tích file'}
              </button>
              <button type="button" className="btn-secondary flex-1"
                disabled={!csvFile || !writableAccountId || csvCommitting} onClick={() => void handleCommitCsv()}>
                {csvCommitting ? 'Đang gửi...' : 'Gửi nhập liệu'}
              </button>
            </div>
            {csvParseResult ? (
              <div className="text-xs text-secondary rounded-lg border border-white/10 p-2">
                Kết quả phân tích: hợp lệ {csvParseResult.recordCount} dòng, bỏ qua {csvParseResult.skippedCount} dòng, lỗi {csvParseResult.errorCount} dòng
              </div>
            ) : null}
            {csvCommitResult ? (
              <div className="text-xs text-secondary rounded-lg border border-white/10 p-2">
                Kết quả gửi: đã lưu {csvCommitResult.insertedCount} dòng, trùng lặp {csvCommitResult.duplicateCount} dòng, thất bại {csvCommitResult.failedCount} dòng
              </div>
            ) : null}
          </div>
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold text-foreground mb-3">Lịch sử giao dịch</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select className="input-terminal text-sm" value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
                <option value="trade">Giao dịch</option>
                <option value="cash">Dòng tiền</option>
                <option value="corporate">Sự kiện DN</option>
              </select>
              <button type="button" className="btn-secondary text-sm" onClick={() => void loadEvents()} disabled={eventLoading}>
                {eventLoading ? 'Đang tải...' : 'Làm mới'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input-terminal text-sm" type="date" value={eventDateFrom} onChange={(e) => setEventDateFrom(e.target.value)} />
              <input className="input-terminal text-sm" type="date" value={eventDateTo} onChange={(e) => setEventDateTo(e.target.value)} />
            </div>
            {(eventType === 'trade' || eventType === 'corporate') ? (
              <input className="input-terminal text-sm w-full" placeholder="Lọc theo mã cổ phiếu" value={eventSymbol}
                onChange={(e) => setEventSymbol(e.target.value)} />
            ) : null}
            {eventType === 'trade' ? (
              <select className="input-terminal text-sm w-full" value={eventSide} onChange={(e) => setEventSide(e.target.value as '' | PortfolioSide)}>
                <option value="">Tất cả chiều giao dịch</option>
                <option value="buy">Mua</option>
                <option value="sell">Bán</option>
              </select>
            ) : null}
            {eventType === 'cash' ? (
              <select className="input-terminal text-sm w-full" value={eventDirection}
                onChange={(e) => setEventDirection(e.target.value as '' | PortfolioCashDirection)}>
                <option value="">Tất cả chiều tiền</option>
                <option value="in">Nạp tiền</option>
                <option value="out">Rút tiền</option>
              </select>
            ) : null}
            {eventType === 'corporate' ? (
              <select className="input-terminal text-sm w-full" value={eventActionType}
                onChange={(e) => setEventActionType(e.target.value as '' | PortfolioCorporateActionType)}>
                <option value="">Tất cả sự kiện DN</option>
                <option value="cash_dividend">Cổ tức tiền mặt</option>
                <option value="split_adjustment">Tách/gộp cổ phiếu</option>
              </select>
            ) : null}
            <div className="text-[11px] text-secondary">
              {writeBlocked ? 'Xoá dòng lệnh chỉ khả dụng khi chọn một tài khoản cụ thể. Hãy chọn tài khoản trước khi xoá.' : 'Nếu có lệnh nhập sai, hãy xoá và nhập lại.'}
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-white/10 p-2">
              {eventType === 'trade' && tradeEvents.map((item) => (
                <div key={`t-${item.id}`} className="flex items-start justify-between gap-3 border-b border-white/5 py-2 text-xs text-secondary">
                  <div className="min-w-0">
                    {item.tradeDate} {formatSideLabel(item.side)} {item.symbol} SL={item.quantity} Giá={item.price}
                  </div>
                  {!writeBlocked ? (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 !px-3 !py-1 !text-[11px]"
                      onClick={() => openDeleteDialog({
                        eventType: 'trade',
                        id: item.id,
                        message: `Xác nhận xoá lệnh ${formatSideLabel(item.side)} ngày ${item.tradeDate} — ${item.symbol} (SL ${item.quantity}, Giá ${item.price})?`,
                      })}
                    >
                      Xoá
                    </button>
                  ) : null}
                </div>
              ))}
              {eventType === 'cash' && cashEvents.map((item) => (
                <div key={`c-${item.id}`} className="flex items-start justify-between gap-3 border-b border-white/5 py-2 text-xs text-secondary">
                  <div className="min-w-0">
                    {item.eventDate} {formatCashDirectionLabel(item.direction)} {item.amount} {item.currency}
                  </div>
                  {!writeBlocked ? (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 !px-3 !py-1 !text-[11px]"
                      onClick={() => openDeleteDialog({
                        eventType: 'cash',
                        id: item.id,
                        message: `Xác nhận xoá dòng tiền ngày ${item.eventDate} — ${formatCashDirectionLabel(item.direction)} ${item.amount} ${item.currency}?`,
                      })}
                    >
                      Xoá
                    </button>
                  ) : null}
                </div>
              ))}
              {eventType === 'corporate' && corporateEvents.map((item) => (
                <div key={`ca-${item.id}`} className="flex items-start justify-between gap-3 border-b border-white/5 py-2 text-xs text-secondary">
                  <div className="min-w-0">
                    {item.effectiveDate} {formatCorporateActionLabel(item.actionType)} {item.symbol}
                  </div>
                  {!writeBlocked ? (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 !px-3 !py-1 !text-[11px]"
                      onClick={() => openDeleteDialog({
                        eventType: 'corporate',
                        id: item.id,
                        message: `Xác nhận xoá sự kiện ${formatCorporateActionLabel(item.actionType)} ngày ${item.effectiveDate} — ${item.symbol}?`,
                      })}
                    >
                      Xoá
                    </button>
                  ) : null}
                </div>
              ))}
              {!eventLoading
                && ((eventType === 'trade' && tradeEvents.length === 0)
                  || (eventType === 'cash' && cashEvents.length === 0)
                  || (eventType === 'corporate' && corporateEvents.length === 0)) ? (
                    <p className="text-xs text-muted text-center py-3">Chưa có dữ liệu</p>
                  ) : null}
            </div>
            <div className="flex items-center justify-between text-xs text-secondary">
              <span>Trang {eventPage} / {totalEventPages}</span>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs px-3 py-1" disabled={eventPage <= 1}
                  onClick={() => setEventPage((prev) => Math.max(1, prev - 1))}>
                  Trước
                </button>
                <button type="button" className="btn-secondary text-xs px-3 py-1" disabled={eventPage >= totalEventPages}
                  onClick={() => setEventPage((prev) => Math.min(totalEventPages, prev + 1))}>
                  Sau
                </button>
              </div>
            </div>
          </div>
        </Card>
      </section>
      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Xoá lệnh sai"
        message={pendingDelete?.message || 'Xác nhận xoá lệnh này?'}
        confirmText={deleteLoading ? 'Đang xoá...' : 'Xác nhận xoá'}
        cancelText="Huỷ"
        isDanger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleteLoading) {
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
};

export default PortfolioPage;
