import { useCallback, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputProps,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { colors, radius, spacing, touchTarget, typography } from "./theme";

type PasswordInputProps = Omit<TextInputProps, "secureTextEntry"> & {
  label?: string;
  error?: string;
};

const TOGGLE_INSET = spacing.sm;
const INPUT_PADDING_RIGHT = touchTarget + spacing.sm;

export function PasswordInput({
  label,
  error,
  style,
  value,
  onSelectionChange,
  textContentType,
  autoComplete,
  ...props
}: PasswordInputProps) {
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const [visible, setVisible] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();

  const handleSelectionChange = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selectionRef.current = event.nativeEvent.selection;
      setSelection(event.nativeEvent.selection);
      onSelectionChange?.(event);
    },
    [onSelectionChange]
  );

  const toggleVisibility = useCallback(() => {
    setVisible((current) => !current);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const nextSelection = selectionRef.current;
      setSelection(nextSelection);
      if (Platform.OS === "android") {
        inputRef.current?.setSelection(nextSelection.start, nextSelection.end);
      }
    });
  }, []);

  const accessibilityLabel = visible ? "Hide password" : "Show password";

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.fieldShell}>
        <TextInput
          ref={inputRef}
          value={value}
          style={[styles.input, error && styles.inputError, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!visible}
          selection={selection}
          onSelectionChange={handleSelectionChange}
          textContentType={visible ? "none" : textContentType}
          autoComplete={visible ? "off" : autoComplete}
          {...props}
        />
        <Pressable
          style={styles.toggle}
          onPress={toggleVisibility}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          hitSlop={8}
          {...(Platform.OS === "web" ? ({ type: "button" } as object) : null)}
        >
          {visible ? (
            <EyeOff size={20} color={colors.textMuted} strokeWidth={2} />
          ) : (
            <Eye size={20} color={colors.textMuted} strokeWidth={2} />
          )}
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  fieldShell: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: INPUT_PADDING_RIGHT,
    color: colors.text,
    fontSize: 16,
    minHeight: touchTarget,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          WebkitTextFillColor: colors.text,
          caretColor: colors.text,
          width: "100%",
        } as object)
      : null),
  },
  inputError: { borderColor: colors.danger },
  toggle: {
    position: "absolute",
    right: TOGGLE_INSET,
    top: 0,
    bottom: 0,
    width: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { ...typography.caption, color: colors.danger },
});
