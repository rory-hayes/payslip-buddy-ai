export interface Highlight {
  /** X position as a percentage (0-100). */
  x: number;
  /** Y position as a percentage (0-100). */
  y: number;
  /** Width as a percentage (0-100). */
  w: number;
  /** Height as a percentage (0-100). */
  h: number;
  /** Optional label describing the highlighted field. */
  label: string;
}

export interface ReviewFields {
  gross: number | null;
  net: number | null;
  tax_income: number | null;
  ni_prsi: number | null;
  pension_employee: number | null;
}

export interface ReviewContext {
  imageUrl: string;
  highlights: Highlight[];
  fields: ReviewFields;
  confidence: number;
  reviewRequired: boolean;
  currency?: string;
}
