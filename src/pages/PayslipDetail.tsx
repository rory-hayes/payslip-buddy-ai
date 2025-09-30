import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { ExplainerCard } from '@/components/ExplainerCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { Payslip } from '@/types/database';

export default function PayslipDetail() {
  const { id } = useParams();

  const { data: payslip, isLoading } = useQuery({
    queryKey: ['payslip', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslips')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Payslip;
    },
    enabled: !!id,
  });

  const formatCurrency = (amount: number | null, currency: string = 'GBP') => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-96" />
        </main>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Payslip not found</h1>
            <Button asChild className="mt-4">
              <Link to="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Button asChild variant="ghost">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{payslip.employer_name || 'Payslip'}</h1>
            <p className="text-muted-foreground mt-1">
              {payslip.pay_date ? new Date(payslip.pay_date).toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }) : 'No date'}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-lg px-3 py-1">
              {formatCurrency(payslip.net, payslip.currency)} Net
            </Badge>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {formatCurrency(payslip.gross, payslip.currency)} Gross
            </Badge>
          </div>
        </div>

        {payslip.explainer_text && (
          <ExplainerCard text={payslip.explainer_text} />
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">Gross Pay</span>
                <span className="font-semibold">{formatCurrency(payslip.gross, payslip.currency)}</span>
              </div>
              <div className="flex justify-between py-2 border-b text-muted-foreground">
                <span>Income Tax</span>
                <span>-{formatCurrency(payslip.tax_income, payslip.currency)}</span>
              </div>
              <div className="flex justify-between py-2 border-b text-muted-foreground">
                <span>{payslip.country === 'UK' ? 'National Insurance' : 'PRSI'}</span>
                <span>-{formatCurrency(payslip.ni_prsi, payslip.currency)}</span>
              </div>
              {(payslip.pension_employee ?? 0) > 0 && (
                <div className="flex justify-between py-2 border-b text-muted-foreground">
                  <span>Pension (Employee)</span>
                  <span>-{formatCurrency(payslip.pension_employee, payslip.currency)}</span>
                </div>
              )}
              {(payslip.student_loan ?? 0) > 0 && (
                <div className="flex justify-between py-2 border-b text-muted-foreground">
                  <span>Student Loan</span>
                  <span>-{formatCurrency(payslip.student_loan, payslip.currency)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 pt-4 font-bold text-lg">
                <span>Net Pay</span>
                <span className="text-success">{formatCurrency(payslip.net, payslip.currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {payslip.pension_employer && (
          <Card className="shadow-card bg-accent/5">
            <CardHeader>
              <CardTitle className="text-lg">Employer Contributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <span>Employer Pension Contribution</span>
                <span className="font-semibold text-success">
                  +{formatCurrency(payslip.pension_employer, payslip.currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button disabled>
            Generate HR Pack (Coming Soon)
          </Button>
        </div>
      </main>
    </div>
  );
}
