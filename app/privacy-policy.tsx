import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";
import { privacyPolicyDocument } from "@/lib/legal/privacy-policy-content";

export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen document={privacyPolicyDocument} />;
}
