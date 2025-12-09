import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  MainTabs: undefined;
  CaseDetail: { alertId?: string; caseId?: string; alert?: any };
  AlertDetail: { alertId: string; alert?: any };
  MuleAccounts: { caseId: string; muleAccounts?: any[] };
  FreezeConfirmation: { caseId: string; frozenAccounts?: any[]; responseTime?: number };
  TeamStatus: { caseId: string };
  OutcomeFeedback: { caseId?: string; alertId?: string };
  MoneyTrail: { caseId: string };
  CaseSuccess: { caseId?: string; outcome?: any };
  Map: { caseId?: string; location?: any };
  SuspectNetwork: { caseId?: string };
  AIAnalysis: { caseId?: string };
  CaseReport: { caseId?: string };
  AR: undefined;
  Evidence: undefined;
  PredictiveAnalytics: undefined;
  PredictionExplanation: { complaintId: string };
  AdvancedReport: undefined;
  SecurityDashboard: undefined;
  AuditLogViewer: undefined;
  ComplianceReports: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

