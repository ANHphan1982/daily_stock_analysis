import type React from 'react';
import type { ReportLanguage, ReportStrategy as ReportStrategyType } from '../../types/analysis';
import { Card } from '../common';
import { DashboardPanelHeader } from '../dashboard';
import { getReportText, normalizeReportLanguage } from '../../utils/reportLanguage';

interface ReportStrategyProps {
  strategy?: ReportStrategyType;
  language?: ReportLanguage;
}

type CardKey = 'idealBuy' | 'secondaryBuy' | 'stopLoss' | 'takeProfit';
type CardType = 'buy' | 'secondary' | 'stop' | 'take';

interface StrategyItemConfig {
  key: CardKey;
  cardType: CardType;
  tone: string;
}

const CARD_CONFIG: StrategyItemConfig[] = [
  { key: 'idealBuy',     cardType: 'buy',       tone: '--home-strategy-buy' },
  { key: 'secondaryBuy', cardType: 'secondary',  tone: '--home-strategy-secondary' },
  { key: 'stopLoss',     cardType: 'stop',       tone: '--home-strategy-stop' },
  { key: 'takeProfit',   cardType: 'take',       tone: '--home-strategy-take' },
];

/** Strings that mean "not applicable" — display as "—" */
const NA_PATTERNS = /^(không áp dụng|不适用|n\/a|na|—|-{1,3})$/i;

function normalizeValue(raw?: string): string {
  if (!raw || raw.trim() === '') return '—';
  if (NA_PATTERNS.test(raw.trim())) return '—';
  return raw.trim();
}

interface StrategyItemProps {
  cardKey: CardKey;
  cardType: CardType;
  label: string;
  value?: string;
  tone: string;
}

const StrategyItem: React.FC<StrategyItemProps> = ({ cardKey, cardType, label, value, tone }) => {
  const display = normalizeValue(value);
  const hasValue = display !== '—';

  return (
    <div
      data-testid={`strategy-card-${cardKey}`}
      data-card-type={cardType}
      className="home-subpanel p-3 relative overflow-hidden"
    >
      <div className="flex flex-col">
        <span
          data-testid={`strategy-label-${cardKey}`}
          className="text-xs text-muted-text mb-0.5"
        >
          {label}
        </span>
        <span
          data-testid={`strategy-value-${cardKey}`}
          className="text-lg font-bold font-mono"
          style={{ color: hasValue ? `var(${tone})` : 'var(--text-muted-text)' }}
        >
          {display}
        </span>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{
          background: hasValue
            ? `linear-gradient(90deg, transparent, var(${tone}), transparent)`
            : 'transparent',
        }}
      />
    </div>
  );
};

export const ReportStrategy: React.FC<ReportStrategyProps> = ({ strategy, language = 'zh' }) => {
  if (!strategy) return null;

  const reportLanguage = normalizeReportLanguage(language);
  const text = getReportText(reportLanguage);

  const labelMap: Record<CardKey, string> = {
    idealBuy:     text.idealBuy,
    secondaryBuy: text.secondaryBuy,
    stopLoss:     text.stopLoss,
    takeProfit:   text.takeProfit,
  };

  return (
    <Card variant="bordered" padding="md" className="home-panel-card">
      <div data-testid="strategy-header">
        <DashboardPanelHeader
          eyebrow={text.strategyPoints}
          title={text.sniperLevels}
          className="mb-3"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CARD_CONFIG.map(({ key, cardType, tone }) => (
          <StrategyItem
            key={key}
            cardKey={key}
            cardType={cardType}
            label={labelMap[key]}
            value={strategy[key]}
            tone={tone}
          />
        ))}
      </div>
    </Card>
  );
};
