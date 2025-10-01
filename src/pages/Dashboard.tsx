import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { SummaryCard } from '@/components/SummaryCard';
import { ExplainerCard } from '@/components/ExplainerCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, Wallet, PiggyBank, Upload, FileText, AlertTriangle, Clock, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Payslip, Anomaly } from '@/types/database';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatMoney, formatDate } from '@/lib/format';
import { inferPeriodType } from '@/lib/period';
import { resolveConflictGroup } from '@/lib/conflicts';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const [selectedEmployer, setSelectedEmployer] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [snoozePeriods, setSnoozePeriods] = useState(1);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: payslips, isLoading: payslipsLoading, refetch: refetchPayslips } = useQuery({
    queryKey: ['payslips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .eq('conflict', false) // Only show non-conflict payslips in totals
        .order('pay_date', { ascending: false });
      
      if (error) throw error;
      return data as Payslip[];
    },
  });

  const { data: anomalies, refetch: refetchAnomalies } = useQuery({
    queryKey: ['anomalies', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('anomalies')
        .select('*, payslips(*)')
        .eq('user_id', user.id) // Explicit scope by user_id
        .eq('muted', false)
        .or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Anomaly[];
    },
    enabled: !!user,
  });

  // Get all payslips including conflicts for conflict resolution
  const { data: allPayslips } = useQuery({
    queryKey: ['all-payslips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .order('pay_date', { ascending: false });
      
      if (error) throw error;
      return data as Payslip[];
    },
  });

  const employers = Array.from(new Set(payslips?.map(p => p.employer_name).filter(Boolean)));
  const filteredPayslips = payslips?.filter(p => {
    const matchesEmployer = selectedEmployer === 'all' || p.employer_name === selectedEmployer;
    
    // Use period_type or infer it from dates as fallback
    const periodType = p.period_type || inferPeriodType(p.period_start, p.period_end);
    const matchesPeriod = periodFilter === 'all' || periodType === periodFilter;
    
    return matchesEmployer && matchesPeriod;
  });

  // Detect conflicts: multiple payslips for same (employer, period_start, period_end)
  const conflictGroups = allPayslips?.reduce((acc, payslip) => {
    if (!payslip.employer_name || !payslip.period_start || !payslip.period_end) return acc;
    
    const key = `${payslip.employer_name}-${payslip.period_start}-${payslip.period_end}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(payslip);
    return acc;
  }, {} as Record<string, Payslip[]>);

  const hasConflicts = Object.values(conflictGroups || {}).some(group => group.length > 1);

  const latestPayslip = filteredPayslips?.[0];

  const handleSnooze = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setSnoozePeriods(1);
    setSnoozeDialogOpen(true);
  };

  const confirmSnooze = async () => {
    if (!selectedAnomaly || !selectedAnomaly.payslips) return;

    // Calculate snooze date based on payslip period type
    const payslip = selectedAnomaly.payslips;
    const baseDate = new Date(payslip.pay_date || new Date());
    let snoozedUntil = new Date(baseDate);

    switch (payslip.period_type) {
      case 'weekly':
        snoozedUntil.setDate(snoozedUntil.getDate() + (7 * snoozePeriods));
        break;
      case 'fortnightly':
        snoozedUntil.setDate(snoozedUntil.getDate() + (14 * snoozePeriods));
        break;
      case 'monthly':
      default:
        snoozedUntil.setMonth(snoozedUntil.getMonth() + snoozePeriods);
        break;
    }

    const { error } = await supabase
      .from('anomalies')
      .update({ snoozed_until: snoozedUntil.toISOString() })
      .eq('id', selectedAnomaly.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to snooze anomaly',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Snoozed',
        description: `Anomaly will reappear after ${formatDate(snoozedUntil.toISOString())}`,
      });
      refetchAnomalies();
    }

    setSnoozeDialogOpen(false);
    setSelectedAnomaly(null);
  };

  const handleMute = async (anomalyId: string) => {
    const { error } = await supabase
      .from('anomalies')
      .update({ muted: true })
      .eq('id', anomalyId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to mute anomaly',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Muted',
        description: 'This anomaly will no longer appear',
      });
      refetchAnomalies();
    }
  };

  const handleResolveConflict = async (selectedPayslipId: string, group: Payslip[]) => {
    const success = await resolveConflictGroup(
      supabase,
      selectedPayslipId,
      group,
      // Optimistic callback - could update local state here if needed
      () => {}
    );

    if (!success) {
      toast({
        title: 'Error',
        description: 'Failed to resolve conflict',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Conflict resolved',
        description: 'Selected payslip will be used for totals',
      });
      // Optimistically refetch to update UI
      refetchPayslips();
    }
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

        {/* Conflict Banner */}
        {hasConflicts && (
          <Alert className="border-yellow-600 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Duplicate Payslips Detected</AlertTitle>
            <AlertDescription>
              You have multiple payslips for the same period. Select which to use for totals below.
            </AlertDescription>
          </Alert>
        )}

        {/* Conflict Resolution */}
        {hasConflicts && Object.entries(conflictGroups || {}).map(([key, group]) => {
          if (group.length <= 1) return null;
          
          return (
            <div key={key} className="bg-card p-4 rounded-lg border border-yellow-200">
              <h3 className="font-semibold mb-3">
                {group[0].employer_name} - {formatDate(group[0].period_start!)} to {formatDate(group[0].period_end!)}
              </h3>
              <div className="space-y-2">
                {group.map(payslip => (
                  <div key={payslip.id} className="flex items-center gap-3 p-3 bg-muted rounded">
                    <input
                      type="radio"
                      name={`conflict-${key}`}
                      checked={!payslip.conflict}
                      onChange={() => handleResolveConflict(payslip.id, group)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <p className="text-sm">Net: {formatMoney(payslip.net, payslip.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {formatDate(payslip.created_at)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Use for totals
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {latestPayslip && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Gross Pay"
                value={formatMoney(latestPayslip.gross, latestPayslip.currency)}
                icon={DollarSign}
              />
              <SummaryCard
                title="Net Pay"
                value={formatMoney(latestPayslip.net, latestPayslip.currency)}
                icon={Wallet}
              />
              <SummaryCard
                title="Total Tax"
                value={formatMoney(latestPayslip.tax_income, latestPayslip.currency)}
                icon={TrendingUp}
              />
              <SummaryCard
                title="Pension"
                value={formatMoney(latestPayslip.pension_employee, latestPayslip.currency)}
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
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="capitalize">{anomaly.type}</AlertTitle>
                      </div>
                      <AlertDescription>{anomaly.message}</AlertDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSnooze(anomaly)}
                        title="Snooze this alert"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMute(anomaly.id)}
                        title="Mute this alert permanently"
                      >
                        <VolumeX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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
                        {formatDate(payslip.pay_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(payslip.net, payslip.currency)}</p>
                      <p className="text-sm text-muted-foreground">Net Pay</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Snooze Dialog */}
      <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze Alert</DialogTitle>
            <DialogDescription>
              How many pay periods should we snooze this alert?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select
              value={snoozePeriods.toString()}
              onValueChange={(v) => setSnoozePeriods(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 period</SelectItem>
                <SelectItem value="2">2 periods</SelectItem>
                <SelectItem value="3">3 periods</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSnooze}>
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
