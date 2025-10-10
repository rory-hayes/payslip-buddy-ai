import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DossierModal, type DossierResponse } from '@/components/DossierModal';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { resolveStorageUrl } from '@/lib/storage';
import type { Job } from '@/types/database';
import { Loader2 } from 'lucide-react';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

type YearlySummaryTriggerProps = {
  className?: string;
};

export function YearlySummaryTrigger({ className }: YearlySummaryTriggerProps) {
  const supabase = getSupabaseClient();
  const { toast } = useToast();
  const { user, session } = useAuth();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [modalOpen, setModalOpen] = useState(false);
  const [dossierData, setDossierData] = useState<DossierResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [dossierJob, setDossierJob] = useState<Job | null>(null);

  const years = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => (currentYear - index).toString());
  }, [currentYear]);

  useEffect(() => {
    if (!user) {
      setDossierJob(null);
      setPdfUrl(null);
      setPdfGenerating(false);
      return;
    }

    let isMounted = true;

    const loadExistingJob = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('kind', 'dossier')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!isMounted) return;

      if (error || !data?.length) {
        if (error) {
          console.error('Failed to load dossier jobs', error);
        }
        setDossierJob(null);
        setPdfUrl(null);
        setPdfGenerating(false);
        return;
      }

      const match = (data as Job[]).find((job) => {
        const jobYear = Number((job.meta || {}).year ?? currentYear);
        return jobYear === Number(selectedYear);
      });

      if (!match) {
        setDossierJob(null);
        setPdfUrl(null);
        setPdfGenerating(false);
        return;
      }

      setDossierJob(match);

      if (match.status === 'done' && match.meta?.download_url) {
        const signed = await resolveStorageUrl(supabase, match.meta.download_url as string);
        if (!isMounted) return;
        setPdfUrl(signed);
        setPdfGenerating(false);
      } else if (['queued', 'running'].includes(match.status)) {
        setPdfGenerating(true);
        setPdfUrl(null);
      } else {
        setPdfGenerating(false);
        setPdfUrl(null);
      }
    };

    loadExistingJob();

    return () => {
      isMounted = false;
    };
  }, [supabase, user, selectedYear, currentYear]);

  useEffect(() => {
    if (!dossierJob || ['done', 'failed'].includes(dossierJob.status)) {
      return;
    }

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', dossierJob.id)
        .single();

      if (!error && data) {
        const jobRecord = data as Job;
        setDossierJob(jobRecord);

        if (jobRecord.status === 'done') {
          setPdfGenerating(false);
          const signed = await resolveStorageUrl(supabase, jobRecord.meta?.download_url as string);
          setPdfUrl(signed);
          toast({
            title: 'Dossier PDF ready',
            description: 'Your yearly summary PDF is available for download.',
          });
          clearInterval(interval);
        } else if (jobRecord.status === 'failed') {
          setPdfGenerating(false);
          toast({
            title: 'Dossier PDF failed',
            description: jobRecord.error || 'Unable to generate dossier PDF.',
            variant: 'destructive',
          });
          clearInterval(interval);
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [dossierJob, supabase, toast]);

  const handleViewSummary = async () => {
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Sign in to view your dossier summary.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/dossier/preview?year=${selectedYear}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load dossier preview (status ${response.status})`);
      }

      const payload = (await response.json()) as DossierResponse;
      setDossierData(payload);
      setModalOpen(true);
    } catch (error: unknown) {
      console.error('Failed to load dossier preview', error);
      toast({
        title: 'Unable to load summary',
        description: getErrorMessage(error, 'An unexpected error occurred.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!user || !session) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in again to request a dossier PDF.',
        variant: 'destructive',
      });
      return;
    }

    setPdfGenerating(true);
    setPdfUrl(null);

    try {
      const response = await fetch('/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          kind: 'dossier',
          meta: { year: Number(selectedYear) },
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

      setDossierJob(payload as Job);
      toast({
        title: 'Dossier PDF requested',
        description: 'We will let you know when the PDF is ready to download.',
      });
    } catch (error: unknown) {
      console.error('Failed to enqueue dossier PDF job', error);
      setPdfGenerating(false);
      toast({
        title: 'Unable to generate dossier PDF',
        description: getErrorMessage(error, 'An unexpected error occurred.'),
        variant: 'destructive',
      });
    }
  };

  const containerClass = ['flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-2">
      <div className={containerClass}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Year</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleViewSummary} disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </span>
          ) : (
            'View summary'
          )}
        </Button>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 underline hover:text-blue-800"
          >
            Download PDF
          </a>
        )}
      </div>
      <DossierModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={dossierData}
        loading={loading}
        pdfUrl={pdfUrl}
        onGeneratePdf={handleGeneratePdf}
        pdfGenerating={pdfGenerating}
      />
    </div>
  );
}
