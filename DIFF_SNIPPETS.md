# Key Remediation Diffs

## Auto-open Review Drawer on Upload
```diff
+  const [handledJobCompletion, setHandledJobCompletion] = useState(false);
+  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
+  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
+  const [activeReviewJobId, setActiveReviewJobId] = useState<string | null>(null);
+
+  useEffect(() => {
+    if (!currentJob || currentJob.status !== 'needs_review') {
+      return;
+    }
+    if (activeReviewJobId === currentJob.id && reviewContext) {
+      return;
+    }
+    const imageUrl = await resolveStorageUrl(supabase, meta.imageUrl || meta.image_url || null, 3600);
+    setReviewContext({
+      imageUrl: imageUrl ?? '',
+      highlights: highlights.map(/* percent coords */),
+      fields: { gross: fields.gross ?? null, net: fields.net ?? null, /* ... */ },
+      confidence: typeof meta.confidence === 'number' ? meta.confidence : 0,
+      reviewRequired: meta.reviewRequired ?? true,
+      currency: fields.currency ?? meta.currency ?? 'GBP',
+    });
+    setActiveReviewJobId(currentJob.id);
+    setReviewDrawerOpen(true);
+  }, [currentJob, supabase, activeReviewJobId, reviewContext]);
+
+  const handleReviewConfirm = async (finalFields: ReviewFields) => {
+    const { data: payslipRow } = await supabase
+      .from('payslips')
+      .select('id')
+      .eq('file_id', currentJob.file_id)
+      .eq('user_id', user.id)
+      .order('created_at', { ascending: false })
+      .limit(1)
+      .single();
+    await supabase
+      .from('payslips')
+      .update({ ...finalFields, review_required: false, confidence_overall: confidenceValue })
+      .eq('id', payslipRow.id);
+    await supabase
+      .from('jobs')
+      .update({ status: 'done', meta: updatedMeta })
+      .eq('id', currentJob.id);
+    toast({ title: 'Review saved', description: 'Your corrections have been applied successfully.' });
+    navigate('/dashboard');
+  };
```${F:src/pages/Upload.tsx†L20-L309}

## Review Drawer Syncs with New Props
```diff
-import { useState } from 'react';
+import { useEffect, useState } from 'react';
-import { formatMoney } from '@/lib/format';
-
-// NOTE: Highlight coordinates are PERCENT (0..100)
-export interface Highlight { /* ... */ }
+import { formatMoney } from '@/lib/format';
+import type { Highlight, ReviewFields } from '@/types/review';
 
 export interface ReviewDrawerProps {
   open: boolean;
   imageUrl: string;
   highlights: Highlight[];
-  fields: {
-    gross: number | null;
-    net: number | null;
-    tax_income: number | null;
-    ni_prsi: number | null;
-    pension_employee: number | null;
-  };
+  fields: ReviewFields;
   confidence?: number;
   reviewRequired: boolean;
   currency?: string;
   onConfirm: (finalFields: ReviewDrawerProps['fields']) => Promise<void>;
   onCancel: () => void;
 }
 
 export function ReviewDrawer({ /* ... */ }: ReviewDrawerProps) {
   const [fields, setFields] = useState(initialFields);
+  useEffect(() => {
+    setFields(initialFields);
+  }, [initialFields]);
```${F:src/components/ReviewDrawer.tsx†L1-L69}

## HR Pack + Review Banner in Payslip Detail
```diff
+  const [hrJob, setHrJob] = useState<Job | null>(null);
+  const [hrGenerating, setHrGenerating] = useState(false);
+  const [hrDownloadUrl, setHrDownloadUrl] = useState<string | null>(null);
+  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
+  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
+  const [reviewJob, setReviewJob] = useState<Job | null>(null);
 
-        <div className="flex gap-3">
-          <Button disabled>
-            Generate HR Pack (Coming Soon)
-          </Button>
-        </div>
+        {payslip.review_required && (
+          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
+            <div>
+              <p className="font-semibold text-yellow-900">Review required</p>
+              <p className="text-sm text-yellow-800">Confirm the extracted values before this payslip is marked as complete.</p>
+            </div>
+            <Button variant="outline" onClick={() => setReviewDrawerOpen(true)} disabled={!reviewContext}>
+              Review now
+            </Button>
+          </div>
+        )}
+
+        <div className="space-y-2">
+          <div className="flex flex-wrap items-center gap-3">
+            <Button onClick={handleGenerateHrPack} disabled={hrGenerating || (hrJob && ['queued', 'running'].includes(hrJob.status))}>
+              {hrGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate HR Pack'}
+            </Button>
+            {hrDownloadUrl && (
+              <a href={hrDownloadUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline hover:text-blue-800">
+                Download HR Pack
+              </a>
+            )}
+          </div>
+          {hrJob && ['queued', 'running'].includes(hrJob.status) && (
+            <p className="text-sm text-muted-foreground flex items-center gap-2">
+              <Loader2 className="h-4 w-4 animate-spin" />
+              Preparing your HR pack…
+            </p>
+          )}
+        </div>
+
+      <ReviewDrawer
+        open={reviewDrawerOpen && Boolean(reviewContext)}
+        imageUrl={reviewContext?.imageUrl ?? ''}
+        highlights={reviewContext?.highlights ?? []}
+        fields={reviewContext?.fields ?? emptyReviewFields}
+        confidence={reviewContext?.confidence ?? 0}
+        reviewRequired={reviewContext?.reviewRequired ?? Boolean(payslip.review_required)}
+        currency={reviewContext?.currency ?? payslip.currency ?? 'GBP'}
+        onConfirm={handleReviewConfirm}
+        onCancel={() => setReviewDrawerOpen(false)}
+      />
```${F:src/pages/PayslipDetail.tsx†L19-L415}

## Dossier Modal PDF Actions
```diff
-interface DossierModalProps {
-  open: boolean;
-  onClose: () => void;
-  data: DossierResponse | null;
-  currency?: string;
-  loading?: boolean;
-}
+interface DossierModalProps {
+  open: boolean;
+  onClose: () => void;
+  data: DossierResponse | null;
+  currency?: string;
+  loading?: boolean;
+  pdfUrl?: string | null;
+  onGeneratePdf?: () => void;
+  pdfGenerating?: boolean;
+}
 
-        <DialogHeader>
+        <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <FileText className="h-5 w-5" />
             Annual Dossier
           </DialogTitle>
           <DialogDescription>
             Your complete year-to-date financial summary and checklist
           </DialogDescription>
+          {(onGeneratePdf || pdfUrl) && (
+            <div className="mt-4 flex flex-wrap items-center gap-3">
+              {pdfUrl ? (
+                <Button variant="outline" size="sm" asChild>
+                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
+                    <Download className="h-4 w-4" />
+                    Download PDF
+                  </a>
+                </Button>
+              ) : onGeneratePdf ? (
+                <Button size="sm" onClick={onGeneratePdf} disabled={pdfGenerating}>
+                  {pdfGenerating ? (
+                    <span className="flex items-center gap-2">
+                      <Loader2 className="h-4 w-4 animate-spin" />
+                      Generating…
+                    </span>
+                  ) : (
+                    <span className="flex items-center gap-2">
+                      <Download className="h-4 w-4" />
+                      Generate PDF
+                    </span>
+                  )}
+                </Button>
+              ) : (
+                <Button size="sm" variant="outline" disabled>
+                  PDF not available
+                </Button>
+              )}
+            </div>
+          )}
         </DialogHeader>
```${F:src/components/DossierModal.tsx†L40-L104}

## Dashboard Yearly Summary Trigger
```diff
+import { YearlySummaryTrigger } from '@/components/YearlySummaryTrigger';
 
-        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
-          <div>
-            <h1 className="text-3xl font-bold">Dashboard</h1>
-            <p className="text-muted-foreground mt-1">Your payslip overview and insights</p>
-          </div>
-          <Button asChild>
-            <Link to="/upload">Upload Payslip</Link>
-          </Button>
-        </div>
+        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
+          <div>
+            <h1 className="text-3xl font-bold">Dashboard</h1>
+            <p className="text-muted-foreground mt-1">Your payslip overview and insights</p>
+          </div>
+          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
+            <Button asChild>
+              <Link to="/upload">Upload Payslip</Link>
+            </Button>
+            <YearlySummaryTrigger className="sm:justify-end" />
+          </div>
+        </div>
```${F:src/pages/Dashboard.tsx†L23-L70}

```diff
+export function YearlySummaryTrigger({ className }: YearlySummaryTriggerProps) {
+  const supabase = getSupabaseClient();
+  const { toast } = useToast();
+  const { user, session } = useAuth();
+  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
+  const [modalOpen, setModalOpen] = useState(false);
+  const [dossierData, setDossierData] = useState<DossierResponse | null>(null);
+  const [loading, setLoading] = useState(false);
+  const [pdfGenerating, setPdfGenerating] = useState(false);
+  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
+  const [dossierJob, setDossierJob] = useState<Job | null>(null);
+
+  const handleViewSummary = async () => {
+    const response = await fetch(`/dossier/preview?year=${selectedYear}`, {
+      headers: { Authorization: `Bearer ${session.access_token}` },
+    });
+    const payload = (await response.json()) as DossierResponse;
+    setDossierData(payload);
+    setModalOpen(true);
+  };
+
+  const handleGeneratePdf = async () => {
+    const { data } = await supabase
+      .from('jobs')
+      .insert({ user_id: user.id, kind: 'dossier', status: 'queued', meta: { year: Number(selectedYear) } })
+      .select()
+      .single();
+    setDossierJob(data as Job);
+  };
+
+  return (
+    <div className="space-y-2">
+      <div className={containerClass}>
+        <Select value={selectedYear} onValueChange={setSelectedYear}>/* ... */</Select>
+        <Button onClick={handleViewSummary} disabled={loading}>View summary</Button>
+        {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer">Download PDF</a>}
+      </div>
+      <DossierModal
+        open={modalOpen}
+        onClose={() => setModalOpen(false)}
+        data={dossierData}
+        loading={loading}
+        pdfUrl={pdfUrl}
+        onGeneratePdf={handleGeneratePdf}
+        pdfGenerating={pdfGenerating}
+      />
+    </div>
+  );
+}
```${F:src/components/YearlySummaryTrigger.tsx†L16-L268}
