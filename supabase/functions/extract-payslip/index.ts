import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

type ExtractionPayload = {
  fields?: Record<string, unknown>;
  highlights?: Array<Record<string, unknown>>;
  confidence?: number;
  review_required?: boolean;
  currency?: string;
  employer_name?: string | null;
  pay_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  period_type?: string | null;
  country?: string | null;
  notes?: string | null;
  explainer_text?: string | null;
  metadata?: Record<string, unknown>;
};

type PayslipRow = {
  id: string;
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not configured for extract-payslip function");
}
if (!SUPABASE_URL) {
  console.error("SUPABASE_URL is not configured for extract-payslip function");
}
if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not configured for extract-payslip function");
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    const num = Number.parseFloat(cleaned);
    if (!Number.isNaN(num)) {
      return num;
    }
  }
  return null;
}

function normalizePercent(value: unknown): number | null {
  const num = parseNumber(value);
  if (num === null) return null;
  const scaled = num <= 1 && num >= -1 ? num * 100 : num;
  const bounded = Math.max(0, Math.min(100, scaled));
  return Math.round(bounded * 10000) / 10000;
}

function normalizeCurrency(value: unknown): "GBP" | "EUR" {
  if (typeof value === "string") {
    const upper = value.trim().toUpperCase();
    if (upper === "EUR" || upper === "€") {
      return "EUR";
    }
    if (upper === "GBP" || upper === "£") {
      return "GBP";
    }
  }
  return "GBP";
}

function normalizeCountry(value: unknown): "UK" | "IE" | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  if (["UK", "UNITED KINGDOM", "GB", "GREAT BRITAIN"].includes(upper)) {
    return "UK";
  }
  if (["IE", "IRELAND", "IRL"].includes(upper)) {
    return "IE";
  }
  return null;
}

function normalizePeriodType(value: unknown): "monthly" | "weekly" | "fortnightly" | "other" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["month", "monthly"].includes(normalized)) return "monthly";
  if (["week", "weekly"].includes(normalized)) return "weekly";
  if (["fortnight", "fortnightly", "biweekly", "bi-weekly"].includes(normalized)) return "fortnightly";
  if (normalized) return "other";
  return null;
}

async function callOpenAi(imageUrl: string): Promise<ExtractionPayload> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      fields: {
        type: "object",
        additionalProperties: false,
        properties: {
          gross: { type: ["number", "string", "null"] },
          net: { type: ["number", "string", "null"] },
          tax_income: { type: ["number", "string", "null"] },
          ni_prsi: { type: ["number", "string", "null"] },
          pension_employee: { type: ["number", "string", "null"] },
          pension_employer: { type: ["number", "string", "null"] },
          currency: { type: ["string", "null"] },
        },
        required: [],
      },
      highlights: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            x: { type: ["number", "string"] },
            y: { type: ["number", "string"] },
            w: { type: ["number", "string"] },
            h: { type: ["number", "string"] },
            label: { type: ["string", "null"] },
          },
          required: ["x", "y", "w", "h"],
        },
      },
      confidence: { type: ["number", "null"] },
      review_required: { type: ["boolean", "null"] },
      employer_name: { type: ["string", "null"] },
      pay_date: { type: ["string", "null"] },
      period_start: { type: ["string", "null"] },
      period_end: { type: ["string", "null"] },
      period_type: { type: ["string", "null"] },
      country: { type: ["string", "null"] },
      currency: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
      explainer_text: { type: ["string", "null"] },
      metadata: { type: ["object", "null"] },
    },
  } as const;

  const body = {
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You are an assistant that extracts structured payroll information from payslip images. Return clean JSON following the provided schema. Ensure numeric values use standard decimals without currency symbols.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Extract the gross pay, net pay, income tax, national insurance or PRSI, employee pension, employer pension, detected currency, employer name, pay date, pay period and any helpful notes. Flag review_required if you are uncertain.",
          },
          {
            type: "input_image",
            image_url: imageUrl,
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "payslip_extraction",
        schema,
      },
    },
    max_output_tokens: 800,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${detail}`);
  }

  const payload = await response.json();
  const text =
    payload?.output?.[0]?.content?.[0]?.text ??
    payload?.content?.[0]?.text ??
    payload?.response ??
    null;

  if (!text || typeof text !== "string") {
    throw new Error("OpenAI response did not include JSON output");
  }

  return JSON.parse(text) as ExtractionPayload;
}

async function updateJobStatus(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  updates: Record<string, unknown>,
) {
  await supabase.from("jobs").update(updates).eq("id", jobId);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase configuration missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { job_id?: string };
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON body", detail: String(error) }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const jobId = body.job_id;
  if (!jobId) {
    return new Response(JSON.stringify({ error: "job_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id,user_id,file_id,status,meta")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!job.file_id) {
    await updateJobStatus(supabase, job.id, {
      status: "failed",
      error: "Job is missing file reference",
    });
    return new Response(JSON.stringify({ error: "Job missing file_id" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  await updateJobStatus(supabase, job.id, {
    status: "running",
    error: null,
    updated_at: new Date().toISOString(),
  });

  const previewPath = `${job.user_id}/${job.file_id}_preview.png`;

  const { data: previewData, error: previewError } = await supabase.storage
    .from("payslips")
    .download(previewPath);

  if (previewError || !previewData) {
    await updateJobStatus(supabase, job.id, {
      status: "failed",
      error: "Preview image not found",
    });
    return new Response(JSON.stringify({ error: "Preview image not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const buffer = await previewData.arrayBuffer();
    const base64 = toBase64(buffer);
    const imageUrl = `data:image/png;base64,${base64}`;

    const extraction = await callOpenAi(imageUrl);
    const fields = extraction.fields ?? {};
    const highlights = Array.isArray(extraction.highlights)
      ? extraction.highlights
      : [];
    const sanitizedHighlights = highlights
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const candidate = item as Record<string, unknown>;
        const x = normalizePercent(candidate["x"]);
        const y = normalizePercent(candidate["y"]);
        const w = normalizePercent(candidate["w"]);
        const h = normalizePercent(candidate["h"]);
        if (x === null || y === null || w === null || h === null) {
          return null;
        }
        const label = typeof candidate["label"] === "string" ? candidate["label"] : "";
        return { x, y, w, h, label };
      })
      .filter((value): value is { x: number; y: number; w: number; h: number; label: string } => Boolean(value));

    const gross = parseNumber(fields.gross);
    const net = parseNumber(fields.net);
    const taxIncome = parseNumber(fields.tax_income);
    const niPrsi = parseNumber(fields.ni_prsi);
    const pensionEmployee = parseNumber(fields.pension_employee);
    const pensionEmployer = parseNumber(fields.pension_employer);
    const currency = normalizeCurrency(fields.currency ?? extraction.currency);
    const metadata = (extraction.metadata ?? {}) as Record<string, unknown>;
    const metadataConfidence =
      typeof metadata["confidence"] === "number"
        ? (metadata["confidence"] as number)
        : null;
    const confidence =
      typeof extraction.confidence === "number"
        ? extraction.confidence
        : metadataConfidence;
    const reviewRequired =
      typeof extraction.review_required === "boolean"
        ? extraction.review_required
        : confidence !== null
          ? confidence < 0.9
          : true;

    const payslipPayload = {
      user_id: job.user_id,
      file_id: job.file_id,
      employer_name: typeof extraction.employer_name === "string" ? extraction.employer_name : null,
      pay_date: typeof extraction.pay_date === "string" ? extraction.pay_date : null,
      period_start: typeof extraction.period_start === "string" ? extraction.period_start : null,
      period_end: typeof extraction.period_end === "string" ? extraction.period_end : null,
      period_type: normalizePeriodType(extraction.period_type),
      country: normalizeCountry(extraction.country),
      currency,
      gross,
      net,
      tax_income: taxIncome,
      ni_prsi: niPrsi,
      pension_employee: pensionEmployee,
      pension_employer: pensionEmployer,
      student_loan: null,
      other_deductions: [],
      ytd: metadata["ytd"] ?? null,
      confidence_overall: confidence,
      review_required: reviewRequired,
      conflict: false,
      explainer_text: typeof extraction.explainer_text === "string" ? extraction.explainer_text : extraction.notes ?? null,
    };

    const { data: payslip, error: payslipError } = await supabase
      .from("payslips")
      .upsert(payslipPayload, {
        onConflict: "file_id",
      })
      .select("id")
      .single();

    if (payslipError || !payslip) {
      throw payslipError ?? new Error("Failed to upsert payslip");
    }

    const updatedMeta = {
      ...(job.meta ?? {}),
      fields: {
        gross,
        net,
        tax_income: taxIncome,
        ni_prsi: niPrsi,
        pension_employee: pensionEmployee,
        pension_employer: pensionEmployer,
        currency,
      },
      confidence,
      reviewRequired,
      imageUrl: previewPath,
      highlights: sanitizedHighlights,
      employer_name: payslipPayload.employer_name,
      pay_date: payslipPayload.pay_date,
      period_start: payslipPayload.period_start,
      period_end: payslipPayload.period_end,
      period_type: payslipPayload.period_type,
      country: payslipPayload.country,
      notes: extraction.notes ?? null,
    };

    await updateJobStatus(supabase, job.id, {
      status: reviewRequired ? "needs_review" : "done",
      meta: updatedMeta,
      error: null,
    });

    if (!reviewRequired) {
      await supabase
        .from("jobs")
        .insert({
          user_id: job.user_id,
          file_id: job.file_id,
          kind: "detect_anomalies",
          status: "queued",
          meta: {
            source_job_id: job.id,
            payslip_id: (payslip as PayslipRow).id,
          },
        });
    }

    return new Response(JSON.stringify({ ok: true, job_id: job.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to process extraction", error);
    await updateJobStatus(supabase, job.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: "Extraction failed", detail: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
