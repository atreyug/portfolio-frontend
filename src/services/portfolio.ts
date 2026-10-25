import { api } from "./client";
import type {
  MutualFundAnalyzeRequest,
  MutualFundPortfolioRequest,
  StockAnalyzeRequest,
} from "@/types/api";

/** Responses are returned verbatim — the UI renders exactly what the API sends. */

export async function analyzeStocks(payload: StockAnalyzeRequest): Promise<unknown> {
  const { data } = await api.post("/api/portfolio/analyze", payload);
  return data as unknown;
}

export async function analyzeMutualFunds(payload: MutualFundAnalyzeRequest): Promise<unknown> {
  const { data } = await api.post("/api/portfolio/mutual-fund/analyze", payload);
  return data as unknown;
}

export async function analyzeMutualFundPortfolio(payload: MutualFundPortfolioRequest): Promise<unknown> {
  const { data } = await api.post("/api/portfolio/mutual-fund/analyze-portfolio", payload);
  return data as unknown;
}
