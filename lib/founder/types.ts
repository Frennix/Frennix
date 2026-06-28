import type { ReactNode } from "react";
import type {
  FounderExportFormat,
  FounderListParams,
  FounderPaginatedResult,
  FounderWidgetRefreshMode,
  StaffCapability,
} from "@frennix/types";

export type { FounderListParams, FounderPaginatedResult, FounderExportFormat, FounderWidgetRefreshMode };

/** Default page size for dashboard tables — tuned for mobile scroll performance. */
export const FOUNDER_DEFAULT_PAGE_SIZE = 25;

export const FOUNDER_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function normalizeListParams(params: FounderListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? FOUNDER_DEFAULT_PAGE_SIZE));
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    search: params.search?.trim() || undefined,
    sortBy: params.sortBy,
    sortDir: params.sortDir ?? "desc",
    filters: params.filters ?? {},
  };
}

export function emptyPaginatedResult<T>(page = 1, pageSize = FOUNDER_DEFAULT_PAGE_SIZE): FounderPaginatedResult<T> {
  return { items: [], total: 0, page, pageSize, hasMore: false };
}

export type FounderWidgetProps = {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  updatedAt?: Date | null;
  refreshMode?: FounderWidgetRefreshMode;
  onRefresh?: () => void;
  onExport?: (format: FounderExportFormat) => void;
  exportEnabled?: boolean;
  filterSlot?: React.ReactNode;
  children: ReactNode;
};

export type FounderTableColumn<T> = {
  key: string;
  label: string;
  width?: number | string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
};

export const FOUNDER_MOBILE_BREAKPOINT = 768;

export function capabilityAllowsRoute(
  capability: StaffCapability | undefined,
  allowed: boolean
): boolean {
  if (!capability) return true;
  return allowed;
}
