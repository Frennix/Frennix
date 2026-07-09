/** Guards expo-router pathname before string methods (can be undefined on first web commit). */
export function safePathname(pathname: string | null | undefined): string {
  return typeof pathname === "string" ? pathname : "";
}

export function isMessagesRoute(pathname: string | null | undefined): boolean {
  const path = safePathname(pathname);
  return path === "/messages" || path.startsWith("/chat/") || path.includes("/messages");
}

export function isChatRoute(pathname: string | null | undefined): boolean {
  return safePathname(pathname).startsWith("/chat/");
}
