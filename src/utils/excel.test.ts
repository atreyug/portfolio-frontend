/**
 * Unit tests for the Excel engine + canonical payload builders.
 * Run with:  npx vitest run
 */
import { describe, expect, it } from "vitest";
import {
  MF_FIELDS,
  STOCK_FIELDS,
  cellToISODate,
  cellToNumber,
  guessColumnMapping,
  mfDerived,
  normalizeExcelRows,
  normalizeHeaderName,
  stockDerived,
  uniqueClientIds,
} from "@/utils/excel";
import {
  buildMonitoringCheckRequest,
  buildMutualFundAnalyzeRequest,
  buildProjectionRequest,
  buildStockAnalyzeRequest,
  MF_HOLDING_KEYS,
  STOCK_HOLDING_KEYS,
} from "@/utils/portfolio";
import { validateMonitoringInputs, validateProjectionInputs } from "@/utils/validate";
import type { MutualFundHoldingInput, StockHoldingInput } from "@/types/api";

/* ------------------------------ Header aliases ---------------------------- */

describe("header normalization + mapping", () => {
  it("normalizes headers case/format-insensitively", () => {
    expect(normalizeHeaderName("Buy Price (₹)")).toBe("buy price");
    expect(normalizeHeaderName("CLIENT-ID")).toBe("client id");
    expect(normalizeHeaderName("  Units_Allotted  ")).toBe("units allotted");
  });

  it("guesses stock column mapping from varied header names", () => {
    const headers = ["Client Code", "Scrip", "Qty", "Avg Cost", "ISIN Code", "LTP", "Notes"];
    const mapping = guessColumnMapping(headers, STOCK_FIELDS);
    expect(mapping.client_id).toBe(0);
    expect(mapping.symbol).toBe(1);
    expect(mapping.quantity).toBe(2);
    expect(mapping.buy_price).toBe(3);
    expect(mapping.isin).toBe(4);
    expect(mapping.current_price).toBe(5);
    expect(mapping.security_name).toBeUndefined();
  });

  it("guesses mutual-fund mapping including NAV and XIRR", () => {
    const headers = ["Client", "Scheme Name", "Units", "Current NAV", "XIRR %"];
    const mapping = guessColumnMapping(headers, MF_FIELDS);
    expect(mapping.client_id).toBe(0);
    expect(mapping.scheme_name).toBe(1);
    expect(mapping.units).toBe(2);
    expect(mapping.current_nav).toBe(3);
    expect(mapping.xirr_pct).toBe(4);
  });

  it("never maps the same header to two canonical fields", () => {
    const headers = ["Value", "Value"];
    const mapping = guessColumnMapping(headers, MF_FIELDS);
    const used = Object.values(mapping);
    expect(new Set(used).size).toBe(used.length);
    expect(used).toHaveLength(1);
  });

  it("collects unique client ids from the mapped column", () => {
    const rows = [["C-2"], ["C-1"], ["C-2"], [""], ["c-1"]];
    // "c-1" and "C-1" are distinct strings here; row filtering is case-insensitive later
    const ids = uniqueClientIds(rows, 0);
    expect(ids).toHaveLength(3);
    expect(new Set(ids)).toEqual(new Set(["C-1", "C-2", "c-1"]));
  });
});

/* -------------------------------- Cell parse ------------------------------- */

describe("cell parsing", () => {
  it("parses numbers with currency symbols, commas and percent signs", () => {
    expect(cellToNumber("1,23,456.50")).toBe(123456.5);
    expect(cellToNumber("₹2,400")).toBe(2400);
    expect(cellToNumber("12.5%")).toBe(12.5);
    expect(cellToNumber(7)).toBe(7);
  });

  it("treats blanks, dashes and N/A as missing", () => {
    expect(cellToNumber("")).toBeUndefined();
    expect(cellToNumber("   ")).toBeUndefined();
    expect(cellToNumber("-")).toBeUndefined();
    expect(cellToNumber("NA")).toBeUndefined();
  });

  it("converts Excel serials, Dates and date strings to ISO", () => {
    expect(cellToISODate(45000)).toBe("2023-03-15");
    expect(cellToISODate(new Date(2024, 0, 5))).toBe("2024-01-05");
    expect(cellToISODate("15/03/2023")).toBe("2023-03-15");
    expect(cellToISODate("2024-01-05")).toBe("2024-01-05");
    expect(cellToISODate("5-1-24")).toBe("2024-01-05");
    expect(cellToISODate("not a date")).toBeUndefined();
    expect(cellToISODate("")).toBeUndefined();
  });
});

/* ----------------------------- Stock normalize ---------------------------- */

const STOCK_MAP = { client_id: 0, symbol: 1, quantity: 2, buy_price: 3, current_price: 4, isin: 5 };

describe("normalizeExcelRows (stock)", () => {
  it("normalizes valid rows and uppercases symbol/ISIN", () => {
    const { rows } = normalizeExcelRows("stock", [["C-1", "reliance", "25", "2450.5", "2900", "ine002a01018"]], STOCK_MAP);
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.symbol).toBe("RELIANCE");
    expect(rows[0].data.isin).toBe("INE002A01018");
    expect(rows[0].data.quantity).toBe(25);
    expect(rows[0].data.client_id).toBe("C-1");
  });

  it("does not reject rows for missing optional columns", () => {
    const { rows } = normalizeExcelRows("stock", [["C-1", "TCS", "10", "3200"]], {
      client_id: 0,
      symbol: 1,
      quantity: 2,
      buy_price: 3,
    });
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.current_price).toBeUndefined();
    expect(rows[0].data.isin).toBeUndefined();
  });

  it("reports clear row-level errors for required/invalid fields", () => {
    const { rows } = normalizeExcelRows(
      "stock",
      [
        ["C-1", "", "10", "100", "", ""], // missing symbol
        ["C-1", "INFY", "abc", "100", "", ""], // bad quantity
        ["C-1", "WIPRO", "5", "-40", "", ""], // negative buy price
      ],
      STOCK_MAP,
    );
    expect(rows[0].errors).toEqual(["symbol: required"]);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].errors[0]).toMatch(/quantity: must be a number/);
    expect(rows[2].errors[0]).toMatch(/buy_price: must be greater than 0/);
    expect(rows[2].rowNumber).toBe(4);
  });

  it("extracts only the selected client's rows (case-insensitive)", () => {
    const { rows, skippedOtherClients } = normalizeExcelRows(
      "stock",
      [
        ["C-1", "TCS", "10", "3200"],
        ["c-1", "INFY", "5", "1500"],
        ["C-2", "WIPRO", "20", "400"],
      ],
      { client_id: 0, symbol: 1, quantity: 2, buy_price: 3 },
      { onlyClientId: "C-1" },
    );
    expect(rows).toHaveLength(2);
    expect(skippedOtherClients).toBe(1);
    expect(rows.map((r) => r.data.symbol)).toEqual(["TCS", "INFY"]);
  });

  it("applies a single override client id to every row", () => {
    const { rows } = normalizeExcelRows(
      "stock",
      [
        ["C-9", "TCS", "10", "3200"],
        ["C-8", "INFY", "5", "1500"],
      ],
      { client_id: 0, symbol: 1, quantity: 2, buy_price: 3 },
      { overrideClientId: "DEMO-CLIENT" },
    );
    expect(rows.every((r) => r.data.client_id === "DEMO-CLIENT")).toBe(true);
  });

  it("flags missing client_id when neither column nor override exists", () => {
    const { rows } = normalizeExcelRows("stock", [["TCS", "10", "3200"]], { symbol: 0, quantity: 1, buy_price: 2 });
    expect(rows[0].errors).toContain("client_id: required");
  });

  it("skips fully blank rows without erroring", () => {
    const result = normalizeExcelRows("stock", [["", "", ""], ["C-1", "TCS", "10", "3200", "", ""]], STOCK_MAP);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedBlank).toBe(1);
  });
});

/* ------------------------------- MF normalize ------------------------------ */

const MF_MAP = { client_id: 0, scheme_name: 1, units: 2, current_nav: 3, xirr_pct: 4 };

describe("normalizeExcelRows (mutual fund)", () => {
  it("derives current_value from units × current_nav when the column is absent", () => {
    const { rows } = normalizeExcelRows("mf", [["C-1", "HDFC Flexi Cap", "128.456", "812.34", ""]], MF_MAP);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.current_value).toBeCloseTo(128.456 * 812.34, 1);
    expect(rows[0].derived).toContain("current_value");
  });

  it("derives current_value even when the mapped column exists but its cell is blank", () => {
    const { rows } = normalizeExcelRows("mf", [["C-1", "Fund", "100", "10", "", "   "]], {
      client_id: 0,
      scheme_name: 1,
      units: 2,
      current_nav: 3,
      xirr_pct: 4,
      current_value: 5,
    });
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.current_value).toBe(1000);
    expect(rows[0].derived).toContain("current_value");
  });

  it("keeps explicit current_value when provided", () => {
    const { rows } = normalizeExcelRows("mf", [["C-1", "Fund", "100", "10", "", "1500"]], {
      client_id: 0,
      scheme_name: 1,
      units: 2,
      current_nav: 3,
      current_value: 5,
    });
    expect(rows[0].data.current_value).toBe(1500);
    expect(rows[0].derived).toEqual([]);
  });

  it("allows negative XIRR but rejects non-positive units", () => {
    const { rows } = normalizeExcelRows(
      "mf",
      [
        ["C-1", "Fund A", "10", "100", "-3.5"],
        ["C-1", "Fund B", "0", "100", "12"],
      ],
      MF_MAP,
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.xirr_pct).toBe(-3.5);
    expect(rows[1].errors[0]).toMatch(/units: must be greater than 0/);
  });

  it("parses percent strings for XIRR", () => {
    const { rows } = normalizeExcelRows("mf", [["C-1", "Fund", "10", "100", "14.2%"]], MF_MAP);
    expect(rows[0].data.xirr_pct).toBeCloseTo(14.2);
  });

  it("requires scheme_name and units only", () => {
    const { rows } = normalizeExcelRows("mf", [["C-1", "", ""]], { client_id: 0, scheme_name: 1, units: 2 });
    expect(rows[0].errors).toEqual(["scheme_name: required", "units: required"]);
  });
});

/* ------------------------------ Derived metrics ---------------------------- */

describe("derived metrics", () => {
  it("computes stock invested/current/P&L/return from sufficient data", () => {
    const d = stockDerived({ quantity: 10, buy_price: 100, current_price: 130 });
    expect(d.invested).toBe(1000);
    expect(d.current).toBe(1300);
    expect(d.pnl).toBe(300);
    expect(d.returnPct).toBeCloseTo(30);
  });

  it("returns undefineds instead of failing when data is insufficient", () => {
    const d = stockDerived({ quantity: 10, buy_price: 100 });
    expect(d.current).toBeUndefined();
    expect(d.pnl).toBeUndefined();
    expect(d.returnPct).toBeUndefined();
  });

  it("derives MF current from units × nav when current_value missing", () => {
    const d = mfDerived({ units: 100, current_nav: 42.5, invested_value: 4000 });
    expect(d.current).toBe(4250);
    expect(d.pnl).toBe(250);
  });
});

/* --------------------------- Canonical payloads ---------------------------- */

describe("canonical payload builders", () => {
  it("sends only whitelisted stock keys and trims/uppercases values", () => {
    const dirty = {
      client_id: "C-1",
      symbol: " reliance ",
      quantity: 25,
      buy_price: 2450,
      isin: " ine002a01018 ",
      exchange: "nse",
      current_price: undefined,
      secret_payload: "MUST-NOT-LEAK",
      some_other_excel_column: 42,
    } as unknown as StockHoldingInput;
    const req = buildStockAnalyzeRequest("C-1", "INR", [dirty]);
    expect(req.currency).toBe("INR");
    expect(req.holdings).toHaveLength(1);
    const keys = Object.keys(req.holdings[0]).sort();
    expect(keys).toEqual([...STOCK_HOLDING_KEYS].filter((k) => k !== "security_name" && k !== "buy_date" && k !== "current_price").sort());
    expect(req.holdings[0].symbol).toBe("RELIANCE");
    expect(req.holdings[0].exchange).toBe("NSE");
    expect(JSON.stringify(req)).not.toContain("MUST-NOT-LEAK");
  });

  it("omits empty optional fields and drops rows missing requireds", () => {
    const holdings: StockHoldingInput[] = [
      { client_id: "C-1", symbol: "TCS", quantity: 1, buy_price: 10, security_name: "" },
      { client_id: "C-1", symbol: "", quantity: 1, buy_price: 10 }, // invalid — dropped
    ];
    const req = buildStockAnalyzeRequest(" C-1 ", undefined, holdings);
    expect(req.client_id).toBe("C-1");
    expect(req.currency).toBeUndefined();
    expect(req.holdings).toHaveLength(1);
    expect("security_name" in req.holdings[0]).toBe(false);
  });

  it("builds MF requests with only canonical keys", () => {
    const dirty = {
      client_id: "C-1",
      scheme_name: " Fund X ",
      units: 10,
      folio_no: " 1234/56 ",
      server_side_secret: true,
    } as unknown as MutualFundHoldingInput;
    const req = buildMutualFundAnalyzeRequest("C-1", "USD", [dirty]);
    const keys = Object.keys(req.holdings[0]);
    expect(keys.every((k) => (MF_HOLDING_KEYS as readonly string[]).includes(k))).toBe(true);
    expect(req.holdings[0].scheme_name).toBe("Fund X");
    expect(req.holdings[0].folio_no).toBe("1234/56");
  });

  it("round-trips through JSON without leaking anything", () => {
    const req = buildStockAnalyzeRequest("C-1", "INR", [
      { client_id: "C-1", symbol: "INFY", quantity: 3, buy_price: 1400.25, buy_date: "2024-06-01" },
    ]);
    const parsed = JSON.parse(JSON.stringify(req)) as typeof req;
    expect(parsed).toEqual(req);
  });
});

/* ------------------------- Projection validation --------------------------- */

describe("projection validation + request building", () => {
  it("requires SIP, duration and return for FUTURE_VALUE", () => {
    const errors = validateProjectionInputs("FUTURE_VALUE", {});
    expect(Object.keys(errors).sort()).toEqual(["duration_months", "expected_return_pct", "monthly_sip_amount"]);
  });

  it("never errors on a missing optional current_investment", () => {
    const errors = validateProjectionInputs("FUTURE_VALUE", {
      monthly_sip_amount: "5000",
      duration_months: "120",
      expected_return_pct: "12",
    });
    expect(errors).toEqual({});
  });

  it("rejects invalid optional values when present", () => {
    const errors = validateProjectionInputs("REQUIRED_SIP", {
      target_amount: "1000000",
      duration_months: "60",
      expected_return_pct: "11",
      current_investment: "abc",
    });
    expect(errors.current_investment).toMatch(/must be a number/);
  });

  it("enforces the TIME_TO_TARGET matrix", () => {
    const errors = validateProjectionInputs("TIME_TO_TARGET", { target_amount: "500000", monthly_sip_amount: "10000" });
    expect(Object.keys(errors)).toEqual(["expected_return_pct"]);
  });

  it("LUMPSUM_GROWTH needs current investment, duration and return only", () => {
    const errors = validateProjectionInputs("LUMPSUM_GROWTH", {
      current_investment: "100000",
      duration_months: "36",
      expected_return_pct: "10",
    });
    expect(errors).toEqual({});
  });

  it("builds requests containing only the fields relevant to the type", () => {
    const req = buildProjectionRequest(
      "LUMPSUM_GROWTH",
      {
        current_investment: "100000",
        duration_months: "36",
        expected_return_pct: "10",
        target_amount: "999999", // irrelevant for this type — must be excluded
      },
      " C-1 ",
      "INR",
    );
    expect(req.projection_type).toBe("LUMPSUM_GROWTH");
    expect(req.client_id).toBe("C-1");
    expect(req.current_investment).toBe(100000);
    expect("target_amount" in req).toBe(false);
    expect("monthly_sip_amount" in req).toBe(false);
  });
});

/* ------------------------- Monitoring validation --------------------------- */

describe("monitoring validation + request building", () => {
  it("requires client_id and symbol only", () => {
    expect(validateMonitoringInputs({ clientId: "C-1", symbol: "TCS" })).toEqual({});
    const errors = validateMonitoringInputs({ clientId: "", symbol: "" });
    expect(errors.clientId).toBeDefined();
    expect(errors.symbol).toBeDefined();
  });

  it("validates optional numbers only when present", () => {
    expect(validateMonitoringInputs({ clientId: "C-1", symbol: "TCS", quantity: "" })).toEqual({});
    const errors = validateMonitoringInputs({ clientId: "C-1", symbol: "TCS", quantity: "x", buyPrice: "-5" });
    expect(errors.quantity).toBeDefined();
    expect(errors.buyPrice).toBeDefined();
  });

  it("builds canonical monitoring bodies", () => {
    const req = buildMonitoringCheckRequest(" c-1 ", " reliance ", { exchange: "nse", quantity: 10 });
    expect(req).toEqual({ client_id: "c-1", symbol: "RELIANCE", exchange: "NSE", quantity: 10 });
    expect("buy_price" in req).toBe(false);
  });
});
