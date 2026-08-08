export type LegalBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "subsection"; title: string };

export type LegalSection = {
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  intro: LegalBlock[];
  sections: LegalSection[];
  contact: {
    heading: string;
    company: string;
    email: string;
  };
};

export function legalParagraph(text: string): LegalBlock {
  return { type: "paragraph", text };
}

export function legalBullets(items: string[]): LegalBlock {
  return { type: "bullets", items };
}

export function legalSubsection(title: string): LegalBlock {
  return { type: "subsection", title };
}
