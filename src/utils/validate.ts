import type { ProjectionType } from "@/types/api";

export const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Parse a user-entered number; returns undefined when blank/invalid. */
export function parseNum(v: string): number | undefined {
  const t = v.trim().replace(/[,₹$%\s]/g, "");
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export const required = (v: string): string | null => (v.trim() === "" ? "This field is required." : null);

export function positiveNumber(v: string, label = "Value", allowZero = false): string | null {
  const n = parseNum(v);
  if (n === undefined) return `${label} is required.`;
  if (allowZero ? n < 0 : n <= 0) return `${label} must be greater than ${allowZero ? "or equal to 0" : "0"}.`;
  return null;
}

export function optionalPositiveNumber(v: string, label = "Value", allowZero = true): string | null {
  if (v.trim() === "") return null;
  const n = parseNum(v);
  if (n === undefined) return `${label} must be a number.`;
  if (allowZero ? n < 0 : n <= 0) return `${label} must be greater than ${allowZero ? "or equal to 0" : "0"}.`;
  return null;
}

export function passwordIssues(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(pw)) return "Password must contain a letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain a number.";
  return null;
}

/* --------------------- Canonical projection validation -------------------- */

export type ProjectionFieldKey =
  | "target_amount"
  | "monthly_sip_amount"
  | "current_investment"
  | "duration_months"
  | "expected_return_pct";

export interface ProjectionFieldMeta {
  label: string;
  hint: string;
  money?: boolean;
  suffix?: string;
}

export const PROJECTION_FIELD_META: Record<ProjectionFieldKey, ProjectionFieldMeta> = {
  target_amount: { label: "Target amount", hint: "The corpus you want to reach.", money: true },
  monthly_sip_amount: { label: "Monthly SIP", hint: "Amount invested every month.", money: true },
  current_investment: { label: "Current investment", hint: "Existing lump sum to include.", money: true },
  duration_months: { label: "Duration (months)", hint: "Investment horizon in months.", suffix: "months" },
  expected_return_pct: {
    label: "Expected return (% p.a.)",
    hint: "Assumed annual return — an estimate, never guaranteed.",
    suffix: "%",
  },
};

/** Which projection inputs are required vs optional, per projection type. */
export const PROJECTION_REQUIREMENTS: Record<
  ProjectionType,
  { required: ProjectionFieldKey[]; optional: ProjectionFieldKey[] }
> = {
  FUTURE_VALUE: {
    required: ["monthly_sip_amount", "duration_months", "expected_return_pct"],
    optional: ["current_investment"],
  },
  REQUIRED_SIP: {
    required: ["target_amount", "duration_months", "expected_return_pct"],
    optional: ["current_investment"],
  },
  TIME_TO_TARGET: {
    required: ["target_amount", "monthly_sip_amount", "expected_return_pct"],
    optional: ["current_investment"],
  },
  LUMPSUM_GROWTH: {
    required: ["current_investment", "duration_months", "expected_return_pct"],
    optional: [],
  },
};

/** All fields relevant to a projection type, in display order (required first). */
export function projectionFieldsFor(type: ProjectionType): { key: ProjectionFieldKey; optional: boolean }[] {
  const req = PROJECTION_REQUIREMENTS[type];
  return [
    ...req.required.map((key) => ({ key, optional: false })),
    ...req.optional.map((key) => ({ key, optional: true })),
  ];
}

/**
 * Validate projection inputs according to the selected projection type.
 * Missing optional fields never produce errors; present-but-invalid ones do.
 */
export function validateProjectionInputs(
  type: ProjectionType,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { key, optional } of projectionFieldsFor(type)) {
    const raw = (values[key] ?? "").trim();
    const label = PROJECTION_FIELD_META[key].label;
    if (raw === "") {
      if (!optional) errors[key] = `${label} is required.`;
      continue;
    }
    const n = parseNum(raw);
    if (n === undefined) {
      errors[key] = `${label} must be a number.`;
    } else if (n <= 0) {
      errors[key] = `${label} must be greater than 0.`;
    }
  }
  return errors;
}

/* --------------------- Canonical monitoring validation -------------------- */

export interface MonitoringFormValues {
  clientId: string;
  symbol: string;
  quantity?: string;
  buyPrice?: string;
}

/** Monitoring: client_id + symbol required; quantity/buy_price optional, numeric when present. */
export function validateMonitoringInputs(input: MonitoringFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.clientId.trim()) errors.clientId = "Client ID is required.";
  if (!input.symbol.trim()) errors.symbol = "Symbol is required.";
  if (input.quantity !== undefined) {
    const err = optionalPositiveNumber(input.quantity, "Quantity", false);
    if (err) errors.quantity = err;
  }
  if (input.buyPrice !== undefined) {
    const err = optionalPositiveNumber(input.buyPrice, "Buy price", false);
    if (err) errors.buyPrice = err;
  }
  return errors;
}
