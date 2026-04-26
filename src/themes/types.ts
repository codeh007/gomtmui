export interface DashboardTheme {
  name?: string;
  label?: string;
  description?: string;
  colors?: Record<string, string>;
  cssVars?: Record<string, string>;
  customCSS?: string;
  [key: string]: unknown;
}
