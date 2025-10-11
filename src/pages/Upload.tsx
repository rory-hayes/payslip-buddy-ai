import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload as UploadIcon, FileText, CheckCircle2, AlertCircle, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordPromptModal } from '@/components/PasswordPromptModal';
import CryptoJS from 'crypto-js';
import { Job } from '@/types/database';
import { ReviewDrawer } from '@/components/ReviewDrawer';
import type { ReviewContext, ReviewFields } from '@/types/review';
import { resolveStorageUrl } from '@/lib/storage';
import { invokeExtract } from '@/lib/edgeFunctions';
import { renderFirstPageToPNG } from '@/utils/pdfPreview';

export default function Upload() {
  const supabase = getSupabaseClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [handledJobCompletion, setHandledJobCompletion] = useState(false);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
  const [activeReviewJobId, setActiveReviewJobId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, session } = useAuth();
  const navigate = useNavigate();

  type RawHighlight = {
    x?: number | string | null;
    y?: number | string | null;
    w?: number | string | null;
    h?: number | string | null;
    label?: string | null;
  };

  const emptyReviewFields: ReviewFields = {
    gross: null,
    net: null,
    tax_income: null,
    ni_prsi: null,
    pension_employee: null,
  };

  // Poll for job status updates
  useEffect(() => {
    if (!currentJob || ['done', 'failed'].includes(currentJob.status)) {
      return;
    }

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', currentJob.id)
        .single();

      if (!error && data) {
        setCurrentJob(data as Job);
        if (['queued', 'running'].includes(data.status)) {
          setHandledJobCompletion(false);
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [currentJob, supabase]);

  useEffect(() => {
    if (!currentJob || currentJob.status !== 'needs_review') {
      return;
    }

    if (activeReviewJobId === currentJob.id && reviewContext) {
      return;
    }

    let isMounted = true;

    const loadReviewContext = async () => {
      const meta = currentJob.meta || {};
      const fields = meta.fields || {};
      const highlights = Array.isArray(meta.highlights) ? meta.highlights : [];
      const imageUrl = await resolveStorageUrl(supabase, meta.imageUrl || meta.image_url || null, 3600);

      if (!isMounted) return;

      setReviewContext({
        imageUrl: imageUrl ?? '',
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
        currency: fields.currency ?? meta.currency ?? 'GBP',
      });
      setActiveReviewJobId(currentJob.id);
      setReviewDrawerOpen(true);
    };

    loadReviewContext();

    return () => {
      isMounted = false;
    };
  }, [currentJob, supabase, activeReviewJobId, reviewContext]);

  useEffect(() => {
    if (!currentJob || handledJobCompletion) {
      return;
    }

    if (currentJob.status === 'done' && !reviewDrawerOpen) {
      setHandledJobCompletion(true);
      toast({
        title: 'Processing complete',
        description: 'Your payslip has been extracted successfully',
      });
      setTimeout(() => navigate('/dashboard'), 1500);
    } else if (currentJob.status === 'failed') {
      setHandledJobCompletion(true);
      toast({
        title: 'Processing failed',
        description: currentJob.error || 'An error occurred during extraction',
        variant: 'destructive',
      });
      setUploading(false);
    }
  }, [currentJob, handledJobCompletion, reviewDrawerOpen, toast, navigate]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Only PDF files are allowed';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const calculateSHA256 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wordArray = CryptoJS.lib.WordArray.create(e.target?.result as ArrayBuffer);
        const hash = CryptoJS.SHA256(wordArray).toString();
        resolve(hash);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const error = validateFile(droppedFile);
      if (error) {
        toast({
          title: 'Invalid file',
          description: error,
          variant: 'destructive',
        });
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        toast({
          title: 'Invalid file',
          description: error,
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const initiateUpload = () => {
    if (passwordProtected) {
      setShowPasswordModal(true);
    } else {
      handleUpload();
    }
  };

  const handlePasswordSubmit = (password: string) => {
    handleUpload(password);
  };

  const handleReviewConfirm = async (finalFields: ReviewFields) => {
    if (!currentJob || !user) {
      throw new Error('No active review job.');
    }

    try {
      const { data: payslipRow, error: payslipError } = await supabase
        .from('payslips')
        .select('id')
        .eq('file_id', currentJob.file_id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (payslipError || !payslipRow) {
        throw payslipError || new Error('Payslip record not found for review.');
      }

      const confidenceValue =
        reviewContext?.confidence ?? (typeof currentJob.meta?.confidence === 'number' ? currentJob.meta.confidence : null);

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
        .eq('id', payslipRow.id);

      if (updatePayslipError) {
        throw updatePayslipError;
      }

      const updatedMeta = {
        ...(currentJob.meta ?? {}),
        fields: {
          ...(currentJob.meta?.fields ?? {}),
          ...finalFields,
        },
        reviewRequired: false,
      };

      const { error: updateJobError } = await supabase
        .from('jobs')
        .update({ status: 'done', meta: updatedMeta })
        .eq('id', currentJob.id);

      if (updateJobError) {
        throw updateJobError;
      }

      setCurrentJob((prev) => (prev ? { ...prev, status: 'done', meta: updatedMeta } : prev));
      setReviewContext((prev) => (prev ? { ...prev, fields: finalFields, reviewRequired: false } : prev));
      setReviewDrawerOpen(false);
      setHandledJobCompletion(true);
      setActiveReviewJobId(null);

      toast({
        title: 'Review saved',
        description: 'Your corrections have been applied successfully.',
      });

      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Failed to persist review', error);
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while saving your changes.';
      toast({
        title: 'Unable to save review',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleUpload = async (pdfPassword?: string) => {
    if (!file || !user) return;
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in again to continue.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Calculate SHA-256 hash
      const sha256 = await calculateSHA256(file);

      // Check for duplicate
      const { data: existingFiles } = await supabase
        .from('files')
        .select('id')
        .eq('sha256', sha256)
        .eq('user_id', user.id);

      if (existingFiles && existingFiles.length > 0) {
        toast({
          title: 'Duplicate file',
          description: 'This payslip has already been uploaded',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      // Upload to Supabase Storage
      const fileId = crypto.randomUUID();
      const filePath = `${user.id}/${fileId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('payslips')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create file record
      const { data: fileRecord, error: fileError } = await supabase
        .from('files')
        .insert({
          id: fileId,
          user_id: user.id,
          sha256,
          s3_key_original: filePath,
          file_name: file.name,
          file_size: file.size,
        })
        .select()
        .single();

      if (fileError) throw fileError;

      // Generate and upload preview image
      const previewBlob = await renderFirstPageToPNG(file);
      const previewPath = `${user.id}/${fileRecord.id}_preview.png`;
      const { error: previewError } = await supabase.storage
        .from('payslips')
        .upload(previewPath, previewBlob, {
          upsert: true,
          contentType: 'image/png',
        });

      if (previewError) throw previewError;

      // Insert job row directly in Supabase
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          user_id: user.id,
          file_id: fileRecord.id,
          kind: 'extract',
          status: 'queued',
          meta: pdfPassword ? { pdfPassword } : {},
        })
        .select('*')
        .single();

      if (jobError || !job) {
        throw jobError ?? new Error('Failed to create extraction job');
      }

      setCurrentJob(job as Job);
      setHandledJobCompletion(false);
      setReviewContext(null);
      setActiveReviewJobId(null);
      setReviewDrawerOpen(false);

      // Invoke edge function to kick off extraction
      await invokeExtract({ supabase, body: { job_id: job.id } });

      toast({
        title: 'Upload successful',
        description: 'Your payslip is being processed',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred during upload.';
      toast({
        title: 'Upload failed',
        description: message,
        variant: 'destructive',
      });
      setUploading(false);
    }
  };

  const getJobStatusIcon = () => {
    if (!currentJob) return null;
    
    switch (currentJob.status) {
      case 'queued':
        return <Clock className="h-5 w-5 text-blue-600 animate-pulse" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'needs_review':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'done':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getJobStatusText = () => {
    if (!currentJob) return '';
    
    switch (currentJob.status) {
      case 'queued':
        return 'Queued for processing...';
      case 'running':
        return 'Extracting data from payslip...';
      case 'needs_review':
        return 'Review required';
      case 'done':
        return 'Processing complete!';
      case 'failed':
        return `Failed: ${currentJob.error || 'Unknown error'}`;
      default:
        return currentJob.status;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Upload Payslip</h1>
            <p className="text-muted-foreground mt-1">
              Upload a PDF payslip to get started with analysis
            </p>
          </div>

          <Card className="shadow-card">
            <CardContent className="p-6">
              {!currentJob ? (
                <>
                  <div
                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-smooth ${
                      dragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    {!file ? (
                      <div className="space-y-4">
                        <div className="bg-primary/10 rounded-full p-6 inline-block">
                          <UploadIcon className="h-12 w-12 text-primary" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold mb-2">
                            Drop your payslip here
                          </p>
                          <p className="text-sm text-muted-foreground mb-4">
                            or click to browse (PDF only, max 10MB, up to 6 pages)
                          </p>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handleChange}
                            className="hidden"
                            id="file-upload"
                          />
                          <Button asChild variant="outline">
                            <label htmlFor="file-upload" className="cursor-pointer">
                              Choose File
                            </label>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-success/10 rounded-full p-6 inline-block">
                          <CheckCircle2 className="h-12 w-12 text-success" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold mb-2">{file.name}</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>

                          {/* Password protection checkbox */}
                          <div className="flex flex-col items-center justify-center gap-2 mb-4">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="password-protected"
                                checked={passwordProtected}
                                onCheckedChange={(checked) => setPasswordProtected(!!checked)}
                              />
                              <Label htmlFor="password-protected" className="cursor-pointer">
                                This PDF is password-protected
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground text-center max-w-md">
                              Most employer portals show a lock icon or ask for a password when opening the file.
                            </p>
                          </div>

                          <div className="flex gap-3 justify-center">
                            <Button
                              onClick={initiateUpload}
                              disabled={uploading}
                              size="lg"
                            >
                              {uploading ? 'Uploading...' : 'Upload & Process'}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setFile(null)}
                              disabled={uploading}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-start gap-3 text-sm text-muted-foreground">
                      <FileText className="h-5 w-5 shrink-0 mt-0.5" />
                      <p>We support PDF payslips only. Make sure your document is clear and readable.</p>
                    </div>
                    <div className="flex items-start gap-3 text-sm text-muted-foreground">
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                      <p>Your data is encrypted and secure. We never share your payslip information.</p>
                    </div>
                  </div>
                </>
              ) : (
                /* Job Status Stepper */
                <div className="space-y-6 py-4">
                  <div className="flex items-center justify-center gap-3">
                    {getJobStatusIcon()}
                    <Badge variant={currentJob.status === 'done' ? 'default' : 'secondary'} className="text-lg px-4 py-2">
                      {getJobStatusText()}
                    </Badge>
                  </div>

                  {/* Progress Steps */}
                  <div className="space-y-4">
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        ['done', 'running', 'needs_review', 'failed'].includes(currentJob.status) ? 'bg-green-50 border border-green-200' : 'bg-muted'
                      }`}
                      aria-current={currentJob.status === 'queued' ? 'step' : undefined}
                    >
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium">File uploaded</span>
                    </div>

                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        currentJob.status === 'running' ? 'bg-blue-50 border border-blue-200' :
                        ['done', 'needs_review', 'failed'].includes(currentJob.status) ? 'bg-green-50 border border-green-200' : 'bg-muted'
                      }`}
                      aria-current={currentJob.status === 'running' ? 'step' : undefined}
                    >
                      {currentJob.status === 'running' ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : ['done', 'needs_review', 'failed'].includes(currentJob.status) ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-medium">Extracting data</span>
                    </div>

                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        currentJob.status === 'done' ? 'bg-green-50 border border-green-200' :
                        currentJob.status === 'needs_review' ? 'bg-yellow-50 border border-yellow-200' :
                        currentJob.status === 'failed' ? 'bg-red-50 border border-red-200' : 'bg-muted'
                      }`}
                      aria-current={['done', 'needs_review', 'failed'].includes(currentJob.status) ? 'step' : undefined}
                    >
                      {currentJob.status === 'done' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : currentJob.status === 'needs_review' ? (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      ) : currentJob.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-medium">
                        {currentJob.status === 'done' ? 'Complete!' :
                         currentJob.status === 'needs_review' ? 'Review required' :
                         currentJob.status === 'failed' ? 'Failed' : 'Finalizing'}
                      </span>
                    </div>
                  </div>

                  {currentJob.status === 'failed' && (
                    <div className="text-center">
                      <Button onClick={() => { setCurrentJob(null); setFile(null); }}>
                        Try Again
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <ReviewDrawer
        open={reviewDrawerOpen && Boolean(reviewContext)}
        imageUrl={reviewContext?.imageUrl ?? ''}
        highlights={reviewContext?.highlights ?? []}
        fields={reviewContext?.fields ?? emptyReviewFields}
        confidence={reviewContext?.confidence ?? 0}
        reviewRequired={reviewContext?.reviewRequired ?? true}
        currency={reviewContext?.currency ?? 'GBP'}
        onConfirm={handleReviewConfirm}
        onCancel={() => {
          if (!reviewContext?.reviewRequired) {
            setReviewDrawerOpen(false);
          }
        }}
      />

      <PasswordPromptModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handlePasswordSubmit}
      />
    </div>
  );
}
