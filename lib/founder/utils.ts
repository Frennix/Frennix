import type { FounderDatePreset } from "@frennix/types";

export function dateRangeForPreset(preset: FounderDatePreset): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until);

  switch (preset) {
    case "15m":
      since.setMinutes(since.getMinutes() - 15);
      break;
    case "today":
      since.setHours(0, 0, 0, 0);
      break;
    case "week": {
      const day = since.getDay();
      const diff = day === 0 ? 6 : day - 1;
      since.setDate(since.getDate() - diff);
      since.setHours(0, 0, 0, 0);
      break;
    }
    case "month":
      since.setDate(1);
      since.setHours(0, 0, 0, 0);
      break;
    default:
      since.setHours(0, 0, 0, 0);
  }

  return { since: since.toISOString(), until: until.toISOString() };
}

export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  if (typeof document === "undefined") {
    console.warn("[founder] download only supported on web in this build");
    return;
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}
