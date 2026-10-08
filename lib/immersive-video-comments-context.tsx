import { createContext, useContext, type ReactNode } from "react";

/** Opens the in-overlay comments sheet (playlist / feed overlay shell). */
export type OpenImmersiveVideoComments = (draft?: string) => void;

const ImmersiveVideoCommentsContext = createContext<OpenImmersiveVideoComments | null>(null);

export function ImmersiveVideoCommentsProvider({
  openComments,
  children,
}: {
  openComments: OpenImmersiveVideoComments;
  children: ReactNode;
}) {
  return (
    <ImmersiveVideoCommentsContext.Provider value={openComments}>
      {children}
    </ImmersiveVideoCommentsContext.Provider>
  );
}

export function useOpenImmersiveVideoComments(): OpenImmersiveVideoComments | null {
  return useContext(ImmersiveVideoCommentsContext);
}
