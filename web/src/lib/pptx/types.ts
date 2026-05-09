export type Severity = "info" | "warning" | "high";

export type Category = "fonts" | "media" | "risk";

export interface Finding {
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  remediation?: string;
  slideIndexes?: number[];
  part?: string;
}

export interface DeckStats {
  slideCount: number;
  fontsReferenced: number;
  fontsEmbedded: number;
  embeddedFontFamilies: string[];
  referencedFontFamilies: string[];
  mediaFileCount: number;
  totalMediaBytes: number;
}

export type AnalyseSuccess = {
  ok: true;
  findings: Finding[];
  stats: DeckStats;
};

export type AnalyseFailure = {
  ok: false;
  error: string;
};

export type AnalyseResult = AnalyseSuccess | AnalyseFailure;
