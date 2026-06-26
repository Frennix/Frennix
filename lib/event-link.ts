import { config } from "@/lib/config";
import { copyEntityLink, shareEntityLink } from "@/lib/entity-link";

export function buildEventLink(eventId: string) {
  const base = config.appUrl.replace(/\/$/, "");
  return `${base}/event/${eventId}`;
}

export async function copyEventLink(eventId: string) {
  await copyEntityLink(buildEventLink(eventId));
}

export async function shareEventLink(eventId: string, title?: string | null) {
  const link = buildEventLink(eventId);
  const headline = title?.trim()
    ? `Join "${title.trim()}" on Frennix`
    : "Join this workout event on Frennix";
  await shareEntityLink({ link, headline });
}
