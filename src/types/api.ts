/**
 * API types derived from the backend's documented contract.
 *
 * Request shapes follow the supplied OpenAPI description. Response payloads are
 * intentionally typed as `unknown`/flexible records: the UI renders the fields
 * the backend actually returns and never assumes fields that are absent.
 */

export type CurrencyCode = "INR" | "USD" | (string & {});

/* ---------------------------------- Auth --------------------------------- */

export interface SignupRequest {
  email: string;
  password: string;
  full_name?: string;
  /** Compatibility alias ignored by Pydantic when extra fields are forbidden-off. */
  name?: string;
}

export interface LoginRequest {
  email: string;
  /** Some FastAPI backends name the credential field `username`. */
  username?: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

/** Manager profile — rendered tolerantly from whatever the backend returns. */
export type ManagerProfile = Record<string, unknown> & {
  id?: string | number;
  email?: string;
  full_name?: string;
  name?: string;
  created_at?: string;
};

export interface UpdateManagerRequest {
  full_name?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  /** Compatibility alias for backends that name it `old_password`. */
  old_password?: string;
  new_password: string;
}

/* --------------------------- Stock portfolio ----------------------------- */

export interface StockHoldingInput {
  client_id: string;
  symbol: string;
  quantity: number;
  buy_price: number;
  security_name?: string;
  isin?: string;
  exchange?: string;
  buy_date?: string;
  current_price?: number;
}

export interface StockAnalyzeRequest {
  client_id: string;
  currency?: string;
  holdings: StockHoldingInput[];
  analysis_question?: string;
}

/* --------------------------- Mutual funds -------------------------------- */

export interface MutualFundHoldingInput {
  client_id: string;
  scheme_name: string;
  units: number;
  scheme_code?: string | number;
  folio_no?: string;
  invested_value?: number;
  current_nav?: number;
  current_value?: number;
  investment_date?: string;
  xirr_pct?: number;
}

export interface MutualFundAnalyzeRequest {
  client_id: string;
  currency?: string;
  holdings: MutualFundHoldingInput[];
  analysis_question?: string;
}

export type ProjectionType =
  | "FUTURE_VALUE"
  | "REQUIRED_SIP"
  | "TIME_TO_TARGET"
  | "LUMPSUM_GROWTH";

  export interface MutualFundPortfolioRequest {
    client_id?: string;
    currency?: string;
    holdings?: MutualFundHoldingInput[];
    projection_type: ProjectionType;
    target_amount?: number;
    monthly_sip_amount?: number;
    current_investment?: number;
    duration_months?: number;
    expected_return_pct?: number;
    analysis_question?: string;
  }

/* ------------------------------ Monitoring ------------------------------- */

export interface MonitoringCheckRequest {
  client_id: string;
  symbol: string;
  exchange?: string;
  quantity?: number;
  buy_price?: number;
}

export interface MonitoringRunRequest {
  client_id?: string;
}

/* -------------------------------- Alerts --------------------------------- */

/** Alert record — fields rendered tolerantly (only those present are shown). */
export type AlertRecord = Record<string, unknown> & {
  id?: string | number;
  alert_id?: string | number;
  title?: string;
  message?: string;
  severity?: string;
  symbol?: string;
  is_read?: boolean;
  read?: boolean;
  created_at?: string;
};
