import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { SummaryCard } from '@/components/SummaryCard';
import { ExplainerCard } from '@/components/ExplainerCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Wallet, PiggyBank, Upload, FileText, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Payslip, Anomaly } from '@/types/database';
import { useState } from 'react';

export default function Dashboard() {
  const [selectedEmployer, setSelectedEmployer] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  const { data: payslips, isLoading: payslipsLoading } = useQuery({
    queryKey: ['payslips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .order('pay_date', { ascending: false });
      
      if (error) throw error;
      return data as Payslip[];
    },
  });

  const { data: anomalies } = useQuery({
    queryKey: ['anomalies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anomalies')
        .select('*, payslips(*)')
        .eq('muted', false)
        .is('snoozed_until', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Anomaly[];
    },
  });

  const employers = Array.from(new Set(payslips?.map(p => p.employer_name).filter(Boolean)));
  const filteredPayslips = payslips?.filter(p => {
    const matchesEmployer = selectedEmployer === 'all' || p.employer_name === selectedEmployer;
    const matchesPeriod = periodFilter === 'all' || p.period_type === periodFilter;
    return matchesEmployer && matchesPeriod;
  });

  const latestPayslip = filteredPayslips?.[0];
  
  const formatCurrency = (amount: number | null, currency: string = 'GBP') => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  if (payslipsLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!payslips || payslips.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="bg-gradient-primary rounded-2xl p-8 inline-block">
              <FileText className="h-16 w-16 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">Welcome to Payslip Companion</h1>
            <p className="text-lg text-muted-foreground">
              Get started by uploading your first payslip. We'll help you understand your earnings, track deductions, and prepare for tax season.
            </p>
            <div className="flex gap-4 justify-center">
              <Button asChild size="lg">
                <Link to="/upload">
                  <Upload className="mr-2 h-5 w-5" />
                  Upload Payslip
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Your payslip overview and insights</p>
          </div>
          <Button asChild>
            <Link to="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Payslip
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={selectedEmployer} onValueChange={setSelectedEmployer}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Employers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employers</SelectItem>
              {employers.map(emp => (
                <SelectItem key={emp} value={emp!}>{emp}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="fortnightly">Fortnightly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {latestPayslip && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Gross Pay"
                value={formatCurrency(latestPayslip.gross, latestPayslip.currency)}
                icon={DollarSign}
              />
              <SummaryCard
                title="Net Pay"
                value={formatCurrency(latestPayslip.net, latestPayslip.currency)}
                icon={Wallet}
              />
              <SummaryCard
                title="Total Tax"
                value={formatCurrency(latestPayslip.tax_income, latestPayslip.currency)}
                icon={TrendingUp}
              />
              <SummaryCard
                title="Pension"
                value={formatCurrency(latestPayslip.pension_employee, latestPayslip.currency)}
                icon={PiggyBank}
              />
            </div>

            <ExplainerCard text={latestPayslip.explainer_text || ''} />
          </>
        )}

        {anomalies && anomalies.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Alerts & Anomalies</h2>
            <div className="space-y-4">
              {anomalies.map(anomaly => (
                <Alert 
                  key={anomaly.id}
                  variant={anomaly.severity === 'error' ? 'destructive' : 'default'}
                  className="shadow-card"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="capitalize">{anomaly.type}</AlertTitle>
                  <AlertDescription>{anomaly.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Recent Payslips</h2>
          <div className="space-y-3">
            {filteredPayslips?.slice(0, 5).map(payslip => (
              <Link
                key={payslip.id}
                to={`/payslips/${payslip.id}`}
                className="block"
              >
                <div className="bg-card p-4 rounded-lg shadow-card hover:shadow-md transition-smooth border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{payslip.employer_name || 'Unknown Employer'}</p>
                      <p className="text-sm text-muted-foreground">
                        {payslip.pay_date ? new Date(payslip.pay_date).toLocaleDateString('en-GB') : 'No date'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(payslip.net, payslip.currency)}</p>
                      <p className="text-sm text-muted-foreground">Net Pay</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
