import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";
import { termsOfServiceDocument } from "@/lib/legal/terms-of-service-content";

export default function TermsOfServiceScreen() {
  return <LegalDocumentScreen document={termsOfServiceDocument} />;
}
