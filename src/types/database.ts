export interface Payslip {
  id: string;
  user_id: string;
  file_id: string;
  employer_name: string | null;
  pay_date: string | null;
  period_start: string | null;
  period_end: string | null;
  period_type: 'monthly' | 'weekly' | 'fortnightly' | 'other' | null;
  country: 'UK' | 'IE' | null;
  currency: 'GBP' | 'EUR';
  gross: number | null;
  net: number | null;
  tax_income: number | null;
  ni_prsi: number | null;
  pension_employee: number | null;
  pension_employer: number | null;
  student_loan: number | null;
  other_deductions: any[];
  ytd: any | null;
  confidence_overall: number | null;
  review_required: boolean;
  conflict: boolean;
  explainer_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface Anomaly {
  id: string;
  user_id: string;
  payslip_id: string;
  type: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  snoozed_until: string | null;
  muted: boolean;
  created_at: string;
  payslips?: Payslip;
}

export interface Settings {
  user_id: string;
  retention_days: 30 | 90;
  region: 'UK' | 'IE';
  locale: string;
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  region: 'UK' | 'IE';
  category: string;
  title: string;
  note: string | null;
  link: string | null;
  sort_order: number;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
