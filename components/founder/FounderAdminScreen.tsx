import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelStaffInvite,
  createStaffInvite,
  getFounderAuditLog,
  listStaffInvites,
  listStaffMembers,
  revokeStaffMembership,
} from "@frennix/api";
import type { StaffRole } from "@frennix/types";
import { STAFF_ROLE_OPTIONS } from "@frennix/types";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { formatStaffRole, useStaffCapability } from "@/lib/founder/useStaffAccess";
import {
  generateStaffInviteToken,
  hashStaffToken,
  staffInviteUrl,
} from "@/lib/founder/crypto";
import { downloadTextFile, rowsToCsv } from "@/lib/founder/utils";
import { Button, colors, spacing, typography } from "@frennix/ui";

export default function FounderAdminScreen() {
  const queryClient = useQueryClient();
  const { allowed: canManageStaff } = useStaffCapability("capability_manage_staff");
  const { allowed: canViewAudit } = useStaffCapability("capability_view_audit");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("admin");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const staffQuery = useQuery({
    queryKey: ["founder-staff-members", staffSearch],
    queryFn: () => listStaffMembers({ search: staffSearch || undefined }),
    enabled: canManageStaff,
  });

  const invitesQuery = useQuery({
    queryKey: ["founder-staff-invites"],
    queryFn: () => listStaffInvites(),
    enabled: canManageStaff,
  });

  const auditQuery = useQuery({
    queryKey: ["founder-audit-log", auditSearch],
    queryFn: () => getFounderAuditLog({ search: auditSearch || undefined }),
    enabled: canViewAudit,
  });

  async function handleCreateInvite() {
    if (!email.trim()) {
      Alert.alert("Email required", "Enter the invitee email address.");
      return;
    }
    setCreating(true);
    try {
      const token = generateStaffInviteToken();
      const tokenHash = await hashStaffToken(token);
      await createStaffInvite(email.trim(), role, tokenHash);
      setInviteLink(staffInviteUrl(token));
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: ["founder-staff-invites"] });
    } catch (error) {
      Alert.alert("Invite failed", error instanceof Error ? error.message : "Could not create invite");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(userId: string, name: string) {
    Alert.alert("Revoke access", `Remove staff access for ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          try {
            await revokeStaffMembership(userId);
            await queryClient.invalidateQueries({ queryKey: ["founder-staff-members"] });
          } catch (error) {
            Alert.alert("Failed", error instanceof Error ? error.message : "Could not revoke");
          }
        },
      },
    ]);
  }

  async function handleCancelInvite(inviteId: string) {
    try {
      await cancelStaffInvite(inviteId);
      await queryClient.invalidateQueries({ queryKey: ["founder-staff-invites"] });
    } catch (error) {
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not cancel invite");
    }
  }

  if (!canManageStaff && !canViewAudit) {
    return (
      <FounderShell title="Admin">
        <Text style={styles.denied}>You do not have permission to manage staff.</Text>
      </FounderShell>
    );
  }

  return (
    <FounderShell title="Admin & Permissions">
      <ScrollView contentContainerStyle={styles.scroll}>
        {canManageStaff ? (
          <>
            <FounderWidget title="Invite Staff" subtitle="Secure invite links · 7-day expiry">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
                {STAFF_ROLE_OPTIONS.filter((r) => r.value !== "owner").map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setRole(option.value)}
                    style={[styles.roleChip, role === option.value && styles.roleChipActive]}
                  >
                    <Text style={[styles.roleChipText, role === option.value && styles.roleChipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Button title={creating ? "Creating…" : "Create Invite Link"} onPress={() => void handleCreateInvite()} />
              {inviteLink ? (
                <View style={styles.linkBox}>
                  <Text style={styles.linkLabel}>Share this one-time link with the invitee:</Text>
                  <Text selectable style={styles.linkText}>
                    {inviteLink}
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        void navigator.clipboard.writeText(inviteLink);
                        Alert.alert("Copied", "Invite link copied to clipboard.");
                      }
                    }}
                  >
                    <Text style={styles.copyText}>Copy link</Text>
                  </Pressable>
                </View>
              ) : null}
            </FounderWidget>

            <FounderWidget
              title="Active Staff"
              subtitle={`${staffQuery.data?.total ?? 0} members`}
              loading={staffQuery.isLoading}
              onRefresh={() => void staffQuery.refetch()}
            >
              <TextInput
                value={staffSearch}
                onChangeText={setStaffSearch}
                placeholder="Search staff…"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              {(staffQuery.data?.items ?? []).map((member) => (
                <View key={member.user_id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>
                      {member.display_name ?? member.username ?? member.user_id.slice(0, 8)}
                    </Text>
                    <Text style={styles.rowSub}>{formatStaffRole(member.role)}</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      void handleRevoke(
                        member.user_id,
                        member.display_name ?? member.username ?? "this user"
                      )
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.revokeText}>Revoke</Text>
                  </Pressable>
                </View>
              ))}
            </FounderWidget>

            <FounderWidget
              title="Pending Invites"
              subtitle={`${invitesQuery.data?.total ?? 0} pending`}
              loading={invitesQuery.isLoading}
              onRefresh={() => void invitesQuery.refetch()}
            >
              {(invitesQuery.data?.items ?? []).map((invite) => (
                <View key={invite.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{invite.email}</Text>
                    <Text style={styles.rowSub}>
                      {formatStaffRole(invite.role)} · expires{" "}
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable onPress={() => void handleCancelInvite(invite.id)} hitSlop={8}>
                    <Text style={styles.revokeText}>Cancel</Text>
                  </Pressable>
                </View>
              ))}
            </FounderWidget>
          </>
        ) : null}

        {canViewAudit ? (
          <FounderWidget
            title="Audit Trail"
            subtitle="All admin actions are logged"
            loading={auditQuery.isLoading}
            onRefresh={() => void auditQuery.refetch()}
            exportEnabled
            onExport={(format) => {
              const rows = auditQuery.data?.items ?? [];
              if (format === "csv") {
                downloadTextFile("frennix-audit-log.csv", rowsToCsv(rows), "text/csv");
              } else {
                downloadTextFile("frennix-audit-log.json", JSON.stringify(rows, null, 2), "application/json");
              }
            }}
          >
            <TextInput
              value={auditSearch}
              onChangeText={setAuditSearch}
              placeholder="Search audit log…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            {(auditQuery.data?.items ?? []).map((entry) => (
              <View key={entry.id} style={styles.auditRow}>
                <Text style={styles.auditAction}>{entry.action}</Text>
                <Text style={styles.auditMeta}>
                  {entry.actor_display_name ?? entry.actor_username ?? "System"} ·{" "}
                  {new Date(entry.created_at).toLocaleString()}
                </Text>
              </View>
            ))}
          </FounderWidget>
        ) : null}
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xl },
  denied: { ...typography.body, color: colors.textSecondary, padding: spacing.md },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
    ...typography.bodySmall,
  },
  roleRow: { gap: spacing.xs, marginBottom: spacing.sm },
  roleChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipActive: { borderColor: colors.accent, backgroundColor: colors.surface },
  roleChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  roleChipTextActive: { color: colors.accent },
  linkBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  linkLabel: { ...typography.caption, color: colors.textSecondary },
  linkText: { ...typography.caption, color: colors.text, fontFamily: "monospace" },
  copyText: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.bodySmall, fontWeight: "600", color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary },
  revokeText: { ...typography.caption, color: colors.danger, fontWeight: "600" },
  auditRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  auditAction: { ...typography.bodySmall, fontWeight: "600", color: colors.text },
  auditMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
