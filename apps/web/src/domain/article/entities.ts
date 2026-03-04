export type ArticleLanguage = "ja" | "en" | "zh";
export type ArticleSourceType = "manual" | "upload" | "ocr";
export type DetectedLanguage = ArticleLanguage | "unknown";

export interface ArticleCreateInput {
  title: string;
  language: ArticleLanguage;
  sourceType: ArticleSourceType;
  text?: string;
  file?: File;
}

export interface ArticleCreateSegment {
  id: string;
  order: number;
  preview: string;
}

export interface ArticleCreateResult {
  articleId: string;
  title: string;
  language: ArticleLanguage;
  detectedLanguage?: DetectedLanguage;
  detectedConfidence?: number;
  detectedReliable?: boolean;
  detectedRawLanguage?: string;
  segments: ArticleCreateSegment[];
}

export interface ArticleListItem {
  articleId: string;
  title: string;
  language: ArticleLanguage;
  segmentCount: number;
  createdAt: string;
}

export interface ArticleListResult {
  items: ArticleListItem[];
  nextCursor?: string;
}

export interface ArticleLanguageDetectInput {
  text: string;
}

export interface ArticleLanguageDetectResult {
  detectedLanguage: DetectedLanguage;
  detectedConfidence?: number;
  detectedReliable: boolean;
  detectedRawLanguage: string;
  textLength: number;
}
