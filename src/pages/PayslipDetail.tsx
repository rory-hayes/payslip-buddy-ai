import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { ExplainerCard } from '@/components/ExplainerCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Payslip, Job } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ReviewDrawer } from '@/components/ReviewDrawer';
import type { ReviewContext, ReviewFields } from '@/types/review';
import { resolveStorageUrl } from '@/lib/storage';

export default function PayslipDetail() {
  const supabase = getSupabaseClient();
  const { id } = useParams();
  const { toast } = useToast();
  const { user, session } = useAuth();
  const [hrJob, setHrJob] = useState<Job | null>(null);
  const [hrGenerating, setHrGenerating] = useState(false);
  const [hrDownloadUrl, setHrDownloadUrl] = useState<string | null>(null);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
  const [reviewJob, setReviewJob] = useState<Job | null>(null);

  const emptyReviewFields: ReviewFields = {
    gross: null,
    net: null,
    tax_income: null,
    ni_prsi: null,
    pension_employee: null,
  };

  type RawHighlight = {
    x?: number | string | null;
    y?: number | string | null;
    w?: number | string | null;
    h?: number | string | null;
    label?: string | null;
  };

  const { data: payslip, isLoading, refetch } = useQuery({
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

  const handleGenerateHrPack = async () => {
    if (!payslip || !user || !session) {
      if (!session) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in again to request an HR pack.',
          variant: 'destructive',
        });
      }
      return;
    }

    if (hrGenerating || (hrJob && ['queued', 'running'].includes(hrJob.status))) {
      return;
    }

    setHrGenerating(true);
    setHrDownloadUrl(null);

    try {
      const response = await fetch('/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          kind: 'hr_pack',
          file_id: payslip.file_id,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        let detail = `Failed to enqueue job (status ${response.status})`;
        if (payload && typeof payload === 'object' && 'detail' in payload) {
          const maybeDetail = (payload as { detail?: unknown }).detail;
          if (typeof maybeDetail === 'string') {
            detail = maybeDetail;
          }
        }
        throw new Error(detail);
      }

      setHrJob(payload as Job);
      toast({
        title: 'HR pack requested',
        description: 'We will notify you when the HR pack is ready.',
      });
    } catch (error: unknown) {
      console.error('Failed to enqueue HR pack', error);
      setHrGenerating(false);
      toast({
        title: 'Unable to generate HR pack',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while creating the HR pack.',
        variant: 'destructive',
      });
    }
  };

  const handleReviewConfirm = async (finalFields: ReviewFields) => {
    if (!reviewJob || !payslip || !user) {
      throw new Error('Review metadata is unavailable.');
    }

    try {
      const confidenceValue =
        reviewContext?.confidence ?? (typeof reviewJob.meta?.confidence === 'number' ? reviewJob.meta.confidence : null);

      const { error: updatePayslipError } = await supabase
        .from('payslips')
        .update({
          gross: finalFields.gross,
          net: finalFields.net,
          tax_income: finalFields.tax_income,
          ni_prsi: finalFields.ni_prsi,
          pension_employee: finalFields.pension_employee,
          review_required: false,
          confidence_overall: confidenceValue,
        })
        .eq('id', payslip.id);

      if (updatePayslipError) {
        throw updatePayslipError;
      }

      const updatedMeta = {
        ...(reviewJob.meta ?? {}),
        fields: {
          ...(reviewJob.meta?.fields ?? {}),
          ...finalFields,
        },
        reviewRequired: false,
      };

      const { error: updateJobError } = await supabase
        .from('jobs')
        .update({ status: 'done', meta: updatedMeta })
        .eq('id', reviewJob.id);

      if (updateJobError) {
        throw updateJobError;
      }

      setReviewContext((prev) => (prev ? { ...prev, fields: finalFields, reviewRequired: false } : prev));
      setReviewJob((prev) => (prev ? { ...prev, status: 'done', meta: updatedMeta } : prev));
      setReviewDrawerOpen(false);

      toast({
        title: 'Review saved',
        description: 'Your updates have been recorded.',
      });

      await refetch();
    } catch (error: unknown) {
      console.error('Failed to persist review corrections', error);
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred.';
      toast({
        title: 'Unable to save review',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    if (!payslip || !user) {
      setHrJob(null);
      setHrDownloadUrl(null);
      setHrGenerating(false);
      return;
    }

    let isMounted = true;

    const loadExistingJob = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('file_id', payslip.file_id)
        .eq('kind', 'hr_pack')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!isMounted) return;

      if (error || !data?.length) {
        if (error) {
          console.error('Failed to load HR pack job', error);
        }
        setHrJob(null);
        setHrDownloadUrl(null);
        setHrGenerating(false);
        return;
      }

      const jobRecord = data[0] as Job;
      setHrJob(jobRecord);

      if (jobRecord.status === 'done' && jobRecord.meta?.download_url) {
        const signed = await resolveStorageUrl(supabase, jobRecord.meta.download_url as string);
        if (!isMounted) return;
        setHrDownloadUrl(signed);
        setHrGenerating(false);
      } else if (['queued', 'running'].includes(jobRecord.status)) {
        setHrGenerating(true);
      }
    };

    loadExistingJob();

    return () => {
      isMounted = false;
    };
  }, [payslip, supabase, user]);

  useEffect(() => {
    if (!hrJob || ['done', 'failed'].includes(hrJob.status)) {
      return;
    }

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', hrJob.id)
        .single();

      if (!error && data) {
        const jobRecord = data as Job;
        setHrJob(jobRecord);

        if (jobRecord.status === 'done') {
          setHrGenerating(false);
          const signed = await resolveStorageUrl(supabase, jobRecord.meta?.download_url as string);
          setHrDownloadUrl(signed);
          toast({
            title: 'HR pack ready',
            description: 'Your downloadable HR pack is ready.',
          });
          clearInterval(interval);
        } else if (jobRecord.status === 'failed') {
          setHrGenerating(false);
          toast({
            title: 'HR pack failed',
            description: jobRecord.error || 'Unable to generate HR pack.',
            variant: 'destructive',
          });
          clearInterval(interval);
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [hrJob, supabase, toast]);

  useEffect(() => {
    if (!payslip || !payslip.review_required || !user) {
      setReviewContext(null);
      setReviewJob(null);
      return;
    }

    let isMounted = true;

    const loadReviewJob = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('file_id', payslip.file_id)
        .eq('kind', 'extract')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data?.length) {
        if (error) {
          console.error('Failed to load review job metadata', error);
        }
        return;
      }

      const jobRecord = data[0] as Job;
      const meta = jobRecord.meta || {};
      const fields = meta.fields || {};
      const highlights = Array.isArray(meta.highlights) ? meta.highlights : [];
      const signedImage = await resolveStorageUrl(supabase, meta.imageUrl || meta.image_url || null, 3600);

      if (!isMounted) return;

      setReviewJob(jobRecord);
      setReviewContext({
        imageUrl: signedImage ?? '',
        highlights: highlights.map((highlight: RawHighlight) => ({
          x: typeof highlight.x === 'number' ? highlight.x : Number(highlight.x ?? 0),
          y: typeof highlight.y === 'number' ? highlight.y : Number(highlight.y ?? 0),
          w: typeof highlight.w === 'number' ? highlight.w : Number(highlight.w ?? 0),
          h: typeof highlight.h === 'number' ? highlight.h : Number(highlight.h ?? 0),
          label: typeof highlight.label === 'string' ? highlight.label : '',
        })),
        fields: {
          gross: fields.gross ?? null,
          net: fields.net ?? null,
          tax_income: fields.tax_income ?? null,
          ni_prsi: fields.ni_prsi ?? null,
          pension_employee: fields.pension_employee ?? null,
        },
        confidence: typeof meta.confidence === 'number' ? meta.confidence : 0,
        reviewRequired: meta.reviewRequired ?? true,
        currency: fields.currency ?? meta.currency ?? payslip.currency ?? 'GBP',
      });
    };

    loadReviewJob();

    return () => {
      isMounted = false;
    };
  }, [payslip, supabase, user]);

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

        {payslip.review_required && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-yellow-900">Review required</p>
              <p className="text-sm text-yellow-800">
                Confirm the extracted values before this payslip is marked as complete.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setReviewDrawerOpen(true)}
              disabled={!reviewContext}
            >
              Review now
            </Button>
          </div>
        )}

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

              {/* Payment Details & Deductions */}
              {payslip.other_deductions && (
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle>Payment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {payslip.other_deductions.pay_items?.map((p, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{p.description}</span>
                          <span>{formatCurrency(p.amount ?? 0, payslip.currency)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle>Deductions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {payslip.other_deductions.items?.map((d, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{d.description}</span>
                          <span>-{formatCurrency(d.amount ?? 0, payslip.currency)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

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

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleGenerateHrPack}
              disabled={hrGenerating || (hrJob && ['queued', 'running'].includes(hrJob.status))}
            >
              {hrGenerating || (hrJob && ['queued', 'running'].includes(hrJob.status)) ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating HR Pack…
                </span>
              ) : (
                'Generate HR Pack'
              )}
            </Button>
            {hrDownloadUrl && (
              <a
                href={hrDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 underline hover:text-blue-800"
              >
                Download HR Pack
              </a>
            )}
          </div>
          {hrJob && ['queued', 'running'].includes(hrJob.status) && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing your HR pack…
            </p>
          )}
          {hrJob?.status === 'failed' && (
            <p className="text-sm text-destructive">HR pack generation failed. Please try again.</p>
          )}
        </div>
      </main>
      <ReviewDrawer
        open={reviewDrawerOpen && Boolean(reviewContext)}
        imageUrl={reviewContext?.imageUrl ?? ''}
        highlights={reviewContext?.highlights ?? []}
        fields={reviewContext?.fields ?? emptyReviewFields}
        confidence={reviewContext?.confidence ?? 0}
        reviewRequired={reviewContext?.reviewRequired ?? Boolean(payslip.review_required)}
        currency={reviewContext?.currency ?? payslip.currency ?? 'GBP'}
        onConfirm={handleReviewConfirm}
        onCancel={() => setReviewDrawerOpen(false)}
      />
    </div>
  );
}
