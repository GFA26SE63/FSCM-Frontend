import { Callout } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { useLocation } from '@/shared/router/compat';
import { ClaimsReportView } from './ClaimsReportView';
import { FinancialReportView } from './FinancialReportView';
import { FulfillmentReportView } from './FulfillmentReportView';
import { InventoryRiskReportView } from './InventoryRiskReportView';
import { LoyaltyReportView } from './LoyaltyReportView';
import { PromotionsReportView } from './PromotionsReportView';
import { ReceivablesReportView } from './ReceivablesReportView';
import { canAccessReport, normalizeReportKind } from './reportLayout';
import './reports.css';

export function OperationsReportsPage() {
  const { user } = useAuth();
  const { search } = useLocation();
  const requested = new URLSearchParams(search).get('kind');
  const { kind, initialTab } = normalizeReportKind(requested, user?.role);

  if (!canAccessReport(kind, user?.role)) {
    return (
      <Callout tone="danger">
        Vai trò của bạn không có quyền xem báo cáo này.
      </Callout>
    );
  }

  switch (kind) {
    case 'financial':
      return <FinancialReportView key="financial" />;
    case 'receivables':
      return <ReceivablesReportView key="receivables" />;
    case 'promotions':
      return <PromotionsReportView key="promotions" />;
    case 'loyalty':
      return <LoyaltyReportView key={`loyalty-${initialTab ?? 'default'}`} initialTab={initialTab} />;
    case 'claims':
      return <ClaimsReportView key="claims" />;
    case 'fulfillment':
      return <FulfillmentReportView key="fulfillment" />;
    case 'inventory-risk':
      return <InventoryRiskReportView key={`risk-${initialTab ?? 'default'}`} initialTab={initialTab} />;
  }
}
