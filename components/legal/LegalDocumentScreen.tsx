import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { LegalBlock, LegalDocument } from "@/lib/legal/types";
import { colors, spacing, typography } from "@frennix/ui";

type LegalDocumentScreenProps = {
  document: LegalDocument;
};

function renderBlock(block: LegalBlock, index: number) {
  switch (block.type) {
    case "paragraph":
      return (
        <Text key={`p-${index}`} style={styles.paragraph}>
          {block.text}
        </Text>
      );
    case "subsection":
      return (
        <Text key={`s-${index}`} style={styles.subsectionTitle}>
          {block.title}
        </Text>
      );
    case "bullets":
      return (
        <View key={`b-${index}`} style={styles.bulletList}>
          {block.items.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bulletMarker}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    default:
      return null;
  }
}

export function LegalDocumentScreen({ document }: LegalDocumentScreenProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{document.title}</Text>
      <Text style={styles.lastUpdated}>Last Updated: {document.lastUpdated}</Text>

      {document.intro.map((block, index) => renderBlock(block, index))}

      {document.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.blocks.map((block, index) => renderBlock(block, index))}
        </View>
      ))}

      <View style={styles.contactSection}>
        <Text style={styles.sectionTitle}>{document.contact.heading}</Text>
        <Text style={styles.paragraph}>{document.contact.company}</Text>
        <Text style={styles.emailLine}>
          Email: <Text style={styles.emailValue}>{document.contact.email}</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === "web"
      ? ({
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        } as object)
      : null),
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl * 2,
    flexGrow: 1,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    ...typography.title,
    fontSize: 26,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  lastUpdated: {
    ...typography.bodySmall,
    color: colors.accent,
    marginBottom: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 18,
    color: colors.white,
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    ...typography.body,
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  paragraph: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.md,
    ...(Platform.OS === "web" ? ({ wordBreak: "break-word" } as object) : null),
  },
  bulletList: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  bulletMarker: {
    ...typography.body,
    color: colors.accent,
    lineHeight: 24,
    width: 16,
  },
  bulletText: {
    ...typography.body,
    flex: 1,
    color: colors.textSecondary,
    lineHeight: 24,
    ...(Platform.OS === "web" ? ({ wordBreak: "break-word" } as object) : null),
  },
  contactSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginBottom: spacing.lg,
  },
  emailLine: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  emailValue: {
    color: colors.accent,
  },
});
