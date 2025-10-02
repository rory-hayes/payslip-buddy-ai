# Payslip Companion - Codex Backend Handoff

**Date:** 2025-10-01  
**Scope:** Production-ready frontend with backend contracts defined  
**Stack:** React + Vite + TypeScript + Supabase + shadcn/ui

---

## 🎯 Executive Summary

The Lovable frontend build is complete and production-ready. All critical security measures, job-based workflows, and UI contracts are implemented. **Codex's primary task is to implement the backend workers that fulfill the job contracts.**

**Status:**
- ✅ Authentication: Fully functional
- ✅ Storage RLS: Owner-only access enforced
- ✅ Database Schema: Complete with proper RLS policies
- ✅ UI Components: All modals, drawers, and pages ready
- ✅ Job System: Frontend enqueues and polls jobs
- 🔧 **Backend Workers: TO BE IMPLEMENTED BY CODEX**

---

## 🗄️ Database Changes Applied

### New Tables Created (with RLS)

#### 1. `jobs` - Async Operation Tracking
```sql
Columns:
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- file_id (uuid, FK to files, nullable)
- kind (enum: extract, detect_anomalies, hr_pack, dossier, delete_all, export_all)
- status (enum: queued, running, needs_review, done, failed)
- error (text, nullable)
- meta (jsonb, for passing parameters like PDF passwords)
- created_at, updated_at (timestamptz)

RLS: Users can only manage their own jobs
```

#### 2. `redactions` - PII Bounding Boxes
```sql
Columns:
- id (uuid, PK)
- file_id (uuid, FK to files)
- boxes (jsonb) - Array of [x, y, w, h, label]
- created_at (timestamptz)

RLS: Users can access redactions for files they own
```

#### 3. `llm_usage` - AI Cost Tracking
```sql
Columns:
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- file_id (uuid, FK to files, nullable)
- model (text, nullable)
- tokens_input, tokens_output (int, nullable)
- cost (numeric, nullable)
- created_at (timestamptz)

RLS: Users can only see their own usage
```

#### 4. `events` - Audit Trail
```sql
Columns:
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- type (text)
- payload (jsonb)
- created_at (timestamptz)

RLS: Users can only access their own events
```

### Storage Security Applied

**Bucket:** `payslips` (private)

**RLS Policies:**
- `users_insert_own_prefix` - Users can only upload to `{user_id}/*`
- `users_select_own_prefix` - Users can only read files under `{user_id}/*`
- `users_delete_own_prefix` - Users can only delete files under `{user_id}/*`

**File Path Convention:** `{user_id}/{file_id}.pdf`

---

## 🧩 New Components Created

### 1. `PasswordPromptModal.tsx`
**Purpose:** Capture PDF password when user uploads password-protected files

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
}
```

**Integration:** Triggered from Upload page when "password-protected" checkbox is checked

---

### 2. `ReviewDrawer.tsx`
**Purpose:** Display extracted payslip data with highlight overlays for user confirmation

**Props:**
```typescript
{
  open: boolean;
  imageUrl: string;              // Redacted first-page preview
  highlights: Highlight[];       // Bounding boxes for fields
  fields: {
    gross: number | null;
    net: number | null;
    tax_income: number | null;
    ni_prsi: number | null;
    pension_employee: number | null;
  };
  confidence?: number;           // 0-1 scale
  reviewRequired: boolean;       // If true, user MUST confirm
  currency?: string;
  onConfirm: (finalFields) => Promise<void>;
  onCancel: () => void;
}

type Highlight = { x: number; y: number; w: number; h: number; label: string };
```

**Behavior:**
- If `reviewRequired === true` or `confidence < 0.9`, user cannot close without confirming
- Highlights are rendered as overlays on the preview image
- User can edit extracted values before confirming

**Backend Contract:** 
- Codex must provide `imageUrl` (redacted first page from storage)
- Codex must provide `highlights` array with bounding box coordinates (%)
- Update `jobs` table status to `needs_review` when user input required

---

### 3. `DossierModal.tsx`
**Purpose:** Display annual financial summary and tax checklist

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  data: DossierResponse | null;
  currency?: string;
  loading?: boolean;
}

type DossierResponse = {
  totals: {
    gross: number;
    net: number;
    tax_income: number;
    ni_prsi: number;
    pension_employee: number;
    pension_employer: number;
  };
  months: Array<{
    month: string;
    gross: number;
    net: number;
    tax_income: number;
    ni_prsi: number;
    pension_employee: number;
  }>;
  checklist: Array<{
    title: string;
    note: string;
    link: string;
  }>;
};
```

**Current State:** Mock data can be passed, but PDF/CSV export buttons are disabled

**Backend Contract:** Codex must implement `dossier` job kind to generate this data structure

---

### 4. `PensionCoachModal.tsx`
**Purpose:** Project pension growth with adjustable assumptions

**Props:**
```typescript
{
  open: boolean;
  onClose: () => void;
  gross: number;
  pension_employee: number;
  assumptions?: {
    cagrPct: number;
    salaryGrowthPct: number;
    years: number;
  };
  currency?: string;
  onEmailReminder?: () => Promise<void>; // Disabled for now
}
```

**Current State:** Client-side projection calculation. Email reminder button disabled.

---

### 5. `src/lib/format.ts` - Utility Functions
**Purpose:** Centralize currency and date formatting

**Functions:**
```typescript
formatMoney(value, currency, locale): string
formatDate(date, locale, options): string
formatNumber(value, locale, options): string
```

**Usage:** Replaced all ad-hoc formatting across Dashboard, Settings, PayslipDetail

---

## 📄 Updated Pages

### 1. Upload Page (`src/pages/Upload.tsx`)

**New Features:**
- ✅ Password-protected PDF checkbox
- ✅ Password modal integration
- ✅ Job-based upload flow (enqueues `jobs('extract')`)
- ✅ Real-time job status stepper (polls jobs table every 2.5s)
- ✅ Visual progress indicators: Queued → Running → Done/Failed/Needs Review

**Flow:**
1. User selects file
2. (Optional) User checks "password-protected" and provides password
3. User clicks "Upload & Process"
4. File uploaded to Storage bucket at `{user_id}/{file_id}.pdf`
5. `files` record created
6. `jobs` record created: `kind='extract', status='queued', meta={pdfPassword?}`
7. UI polls `jobs` table for status updates
8. On `status='done'`, redirect to Dashboard
9. On `status='failed'`, show error and "Try Again" button

**Backend Contract (Codex):**
- Listen for `jobs` where `kind='extract' AND status='queued'`
- Fetch file from Storage using `s3_key_original`
- Extract data using OCR/LLM (use `meta.pdfPassword` if present)
- Create/update `payslips` record
- Create `redactions` record with bounding boxes
- Update `jobs.status` to:
  - `running` while processing
  - `needs_review` if confidence < 0.9 or issues detected
  - `done` if successful
  - `failed` with error message if error

---

### 2. Dashboard Page (`src/pages/Dashboard.tsx`)

**New Features:**
- ✅ Employer filter (dropdown of distinct employers)
- ✅ Period filter (monthly/weekly/fortnightly)
- ✅ Conflict detection for duplicate payslips (same employer + period)
- ✅ Conflict resolution UI (radio buttons: "Use for totals")
- ✅ Anomaly snooze (dialog with 1/2/3 periods selector)
- ✅ Anomaly mute (permanent dismiss)

**Filters:**
- Employer dropdown populated from `payslips.employer_name`
- Period dropdown filters by `payslips.period_type`
- Both filters apply to summary cards, charts, and payslip list

**Conflict Handling:**
- Detects multiple payslips for same `(employer_name, period_start, period_end)`
- Displays conflict banner and resolution UI
- User selects one payslip via radio button
- Updates `payslips.conflict` boolean (true for non-selected, false for selected)
- Summary cards and charts filter `WHERE conflict=false`

**Anomaly Actions:**
- **Snooze:** Opens dialog, user selects N periods, calculates `snoozed_until` date based on payslip period type, updates `anomalies.snoozed_until`
- **Mute:** Sets `anomalies.muted=true`, hides permanently

**Backend Contract (Codex):**
- Implement anomaly detection rules in `detect_anomalies` job
- Populate `anomalies` table with `type`, `severity`, `message`
- Examples: sudden drops in pay, missing pension contributions, unusual tax rates

---

### 3. Settings Page (`src/pages/Settings.tsx`)

**New Features:**
- ✅ "Export All Data" → Enqueues `jobs('export_all')`
- ✅ "Delete All Data" → Enqueues `jobs('delete_all')` with confirmation
- ✅ Real-time job status indicators (polls active jobs every 3s)
- ✅ Buttons disabled while job is active

**Flow (Export All):**
1. User clicks "Export All Data"
2. `jobs` record created: `kind='export_all', status='queued'`
3. UI polls and shows "Exporting..." with spinner
4. Backend processes, generates ZIP/CSV
5. Job completes, user can download from generated URL (TBD by Codex)

**Flow (Delete All):**
1. User clicks "Delete All Data" → Confirmation dialog
2. `jobs` record created: `kind='delete_all', status='queued'`
3. UI polls and shows "Deleting..." with spinner
4. Backend deletes all user's `payslips`, `files`, `anomalies`, `jobs`, storage files
5. Job completes, user sees success message

**Backend Contract (Codex):**
- Implement `export_all` job: Generate CSV/ZIP of all user data, store in Storage, provide signed URL
- Implement `delete_all` job: Hard delete all user records (respect foreign keys), remove from Storage

---

## 🔐 Security Checklist

| Item | Status |
|------|--------|
| Storage RLS policies (owner-only) | ✅ Implemented |
| Jobs table RLS (own rows) | ✅ Implemented |
| Redactions table RLS (via file ownership) | ✅ Implemented |
| LLM usage table RLS (own rows) | ✅ Implemented |
| Events table RLS (own rows) | ✅ Implemented |
| File path convention enforced | ✅ `{user_id}/{file_id}.pdf` |
| Signed URLs for file access | ✅ Lovable uses Supabase signed URLs |

---

## 🚧 TODOs for Codex (Backend Implementation)

### **Phase 1: PDF Extraction Worker (CRITICAL)**

**Job Kind:** `extract`

**Input:**
- `file_id` from `jobs.file_id`
- Fetch `files.s3_key_original` to get storage path
- Optional: `jobs.meta.pdfPassword` (string, if provided)

**Process:**
1. Download PDF from Storage bucket
2. If password provided, decrypt PDF
3. OCR/parse PDF (use `pdfjs-dist` or external OCR service)
4. Extract fields:
   - `employer_name`, `pay_date`, `period_start`, `period_end`, `period_type`
   - `gross`, `net`, `tax_income`, `ni_prsi`, `pension_employee`, `pension_employer`, `student_loan`
   - `country`, `currency`
   - YTD totals (if available)
5. LLM analysis:
   - Generate `explainer_text` (friendly summary of payslip)
   - Calculate `confidence_overall` (0-1 scale)
   - Set `review_required` if confidence < 0.9 or issues detected
6. Generate redacted first-page image:
   - Overlay boxes on PII fields
   - Upload to Storage as `{user_id}/{file_id}_redacted.png`
   - Store bounding boxes in `redactions` table
7. Insert/update `payslips` record
8. Log LLM usage in `llm_usage` table
9. Update `jobs.status`:
   - `done` if successful
   - `needs_review` if confidence < 0.9
   - `failed` with error message if error

**Deliverables:**
- Edge function: `extract-payslip`
- Triggered by: `jobs` insert/update where `kind='extract' AND status='queued'`
- Updates: `payslips`, `redactions`, `llm_usage`, `jobs`

---

### **Phase 2: Anomaly Detection Worker**

**Job Kind:** `detect_anomalies`

**Trigger:** After each successful extraction OR on-demand

**Rules to Implement:**
1. **Sudden pay drop:** Gross/net pay decreased by >15% vs. previous payslip
2. **Missing pension:** Employer had pension contributions in past, now zero
3. **Tax spike:** Income tax increased disproportionately vs. gross pay increase
4. **Duplicate period:** Multiple payslips for same period (flag conflict)
5. **Unusual deductions:** New deduction types not seen before

**Process:**
1. Query user's payslips (last 12 months)
2. Run anomaly detection rules
3. Insert findings into `anomalies` table:
   - `type` (e.g., "sudden_pay_drop", "missing_pension")
   - `severity` ("info" | "warn" | "error")
   - `message` (user-friendly explanation)
   - `payslip_id` (FK to affected payslip)
4. Update `jobs.status='done'`

**Deliverables:**
- Edge function: `detect-anomalies`
- Triggered by: `jobs` where `kind='detect_anomalies' AND status='queued'`
- Updates: `anomalies`, `jobs`

---

### **Phase 3: Dossier Generation Worker**

**Job Kind:** `dossier`

**Input:**
- User ID (from `jobs.user_id`)
- Optional date range (from `jobs.meta`)

**Process:**
1. Aggregate user's payslips (YTD or custom range)
2. Calculate totals: gross, net, tax, NI/PRSI, pensions
3. Generate monthly breakdown
4. Fetch region-specific checklist from `kb` table
5. Return `DossierResponse` shape (see above)
6. (Optional) Generate PDF report, store in Storage, provide signed URL
7. Update `jobs.status='done'` with result in `jobs.meta.result`

**Deliverables:**
- Edge function: `generate-dossier`
- Triggered by: `jobs` where `kind='dossier' AND status='queued'`
- Updates: `jobs`

---

### **Phase 4: HR Pack Generation Worker**

**Job Kind:** `hr_pack`

**Input:**
- `file_id` (from `jobs.file_id`)

**Process:**
1. Fetch `payslips` record by `file_id`
2. Generate employer-facing summary PDF:
   - Payslip metadata (dates, amounts)
   - Link to redacted payslip image
   - Verification statement
3. Store PDF in Storage bucket
4. Update `jobs.meta.download_url` with signed URL
5. Update `jobs.status='done'`

**Deliverables:**
- Edge function: `generate-hr-pack`
- Triggered by: `jobs` where `kind='hr_pack' AND status='queued'`
- Updates: `jobs`

---

### **Phase 5: Export All Worker**

**Job Kind:** `export_all`

**Process:**
1. Fetch all user's `payslips`, `files`, `anomalies`, `settings`
2. Generate CSV exports for each table
3. Download all original PDFs from Storage
4. Create ZIP archive with:
   - `payslips.csv`
   - `files.csv`
   - `anomalies.csv`
   - `pdfs/` folder with all original files
5. Upload ZIP to Storage bucket
6. Generate signed URL (24-hour expiry)
7. Update `jobs.meta.download_url` with signed URL
8. Update `jobs.status='done'`

**Deliverables:**
- Edge function: `export-all`
- Triggered by: `jobs` where `kind='export_all' AND status='queued'`
- Updates: `jobs`

---

### **Phase 6: Delete All Worker**

**Job Kind:** `delete_all`

**Process:**
1. Delete all user's records:
   - `anomalies` (cascade will handle due to FK)
   - `payslips` (cascade will handle due to FK)
   - `redactions` (cascade will handle due to FK)
   - `files`
   - `llm_usage`
   - `events`
   - `jobs` (except current job)
2. Delete all files from Storage bucket under `{user_id}/*`
3. Update `jobs.status='done'`
4. (Optional) Delete `settings` and `profiles` records

**Deliverables:**
- Edge function: `delete-all`
- Triggered by: `jobs` where `kind='delete_all' AND status='queued'`
- Updates: `jobs`, deletes data

---

### **Phase 7: Data Retention Worker (Cron)**

**Schedule:** Daily at 2:00 AM UTC

**Process:**
1. Query `settings` table for all users
2. For each user:
   - Calculate cutoff date: `now() - retention_days`
   - Find `files` where `created_at < cutoff`
   - Delete from Storage bucket
   - Delete from `files` table (cascade will delete `payslips`, `redactions`)
3. Log deletions to `events` table

**Deliverables:**
- Edge function: `data-retention`
- Triggered by: `pg_cron` daily schedule
- Updates: Deletes old data

---

### **Phase 8: Knowledge Base Population**

**Manual Task:** Populate `kb` table with tax/HR guidance

**Example Records:**
```sql
INSERT INTO public.kb (region, category, title, note, link, sort_order) VALUES
  ('UK', 'Tax', 'Income Tax Bands 2025/26', 'Personal allowance: £12,570...', 'https://gov.uk/...', 1),
  ('UK', 'Pension', 'Auto-enrolment Minimums', 'Employer: 3%, Employee: 5%...', 'https://gov.uk/...', 2),
  ('IE', 'Tax', 'PAYE Tax Credits', 'Personal tax credit: €1,875...', 'https://revenue.ie/...', 1);
```

**Deliverable:** SQL script or admin panel for KB management

---

## 📝 Environment Variables

**For Non-Lovable Builds:**

Create `.env` file with:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=YOUR-PROJECT-ID
```

**Note:** Lovable builds use inline configuration in `src/integrations/supabase/client.ts`

---

## 🎨 Design System Notes

**Color Tokens:** All colors use HSL via CSS variables in `src/index.css`
- Primary, secondary, accent, muted, destructive
- Gradients: `--gradient-primary`
- Shadows: `--shadow-card`, `--shadow-elegant`

**Typography:** System font stack with fallbacks

**Components:** shadcn/ui components with custom variants defined in `src/components/ui/`

**Accessibility:**
- Focus traps in Drawer/Dialog
- ARIA labels on highlight overlays
- Keyboard navigation for stepper

---

## 🧪 Testing TODOs (Out of Scope for Lovable)

- Unit tests for utility functions (`src/lib/format.ts`)
- Integration tests for job polling logic
- E2E tests for upload → extraction → review flow
- Load testing for concurrent job processing

---

## 📦 Dependencies Used

**Core:**
- `@supabase/supabase-js` - Database and Storage client
- `@tanstack/react-query` - Data fetching and caching
- `react-router-dom` - Routing
- `crypto-js` - SHA-256 hashing for deduplication

**UI:**
- `shadcn/ui` components (Radix primitives + Tailwind)
- `lucide-react` - Icons
- `sonner` - Toast notifications

**PDF (Client-side, for future use):**
- `pdfjs-dist` - Installed but not yet used in UI

---

## 🚀 Deployment Checklist

### Frontend (Lovable)
- ✅ Auth configured
- ✅ Storage bucket created
- ✅ RLS policies active
- ✅ All routes protected
- ✅ Environment variables set

### Backend (Codex)
- ⏳ Deploy Edge Functions to Supabase
- ⏳ Set up `pg_cron` for data retention
- ⏳ Configure secrets (LLM API keys, OCR service keys)
- ⏳ Test job processing end-to-end
- ⏳ Monitor `llm_usage` for cost tracking

---

## 📞 Support

**For Codex Questions:**
- Lovable codebase: All files in `src/`
- Database schema: Check Supabase Dashboard → Database
- Job contracts: See Phase 1-8 above
- UI contracts: See component prop types above

**Critical Files for Backend Integration:**
- `src/types/database.ts` - All TypeScript interfaces
- `src/pages/Upload.tsx` - Job enqueuing example
- `src/components/ReviewDrawer.tsx` - Expected data shape

---

## ✅ Acceptance Criteria (Met)

- [x] Storage RLS policies active; owner-only access confirmed
- [x] New tables created with RLS; types generated
- [x] Upload enqueues jobs('extract'); stepper reflects job status
- [x] Password modal captures and passes PDF password in jobs.meta
- [x] ReviewDrawer renders with highlight overlays and blocks exit when needed
- [x] Dashboard has Employer & Period filters; anomaly Snooze/Mute wired
- [x] Conflict UI allows choosing "Use for totals"; charts ignore conflict=true
- [x] Dossier & Pension modals render with locked response shapes
- [x] Settings "Delete all" & "Export all" enqueue jobs and render status
- [x] Currency/date formatting centralized in src/lib/format.ts
- [x] Basic a11y improvements (focus traps, ARIA labels, keyboard nav)
- [x] No scope added beyond the specified list

---

## 🎉 Summary for Codex

**What's Ready:**
- Full-stack database schema with security
- Complete UI with job polling
- All modals, drawers, and pages wired up
- Contracts defined for all backend workers

**What Codex Must Build:**
1. Extract payslip data from PDFs (Phase 1) ← **START HERE**
2. Detect anomalies (Phase 2)
3. Generate dossier reports (Phase 3)
4. Create HR packs (Phase 4)
5. Export/delete all user data (Phases 5-6)
6. Data retention cron job (Phase 7)
7. Populate knowledge base (Phase 8)

**Handoff Artifact:** This document (`CODEX_HANDOFF.md`)

Good luck, Codex! 🚀
