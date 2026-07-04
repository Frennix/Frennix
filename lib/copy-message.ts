import { copyEntityLink } from "@/lib/entity-link";

export async function copyMessageText(content: string) {
  const text = content.trim();
  if (!text) return;
  await copyEntityLink(text, "Message copied");
}
