/** In-app legal routes — always use these for navigation inside Frennix. */
export const LEGAL_ROUTES = {
  privacyPolicy: "/privacy-policy",
  termsOfService: "/terms-of-service",
} as const;

export type LegalRoute = (typeof LEGAL_ROUTES)[keyof typeof LEGAL_ROUTES];
