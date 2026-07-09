import { Text, type TextStyle } from "react-native";
import { colors } from "./theme";

type HighlightedTextProps = {
  text: string;
  query?: string;
  style?: TextStyle;
  highlightStyle?: TextStyle;
  numberOfLines?: number;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightedText({
  text,
  query,
  style,
  highlightStyle,
  numberOfLines,
}: HighlightedTextProps) {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 2) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const pattern = new RegExp(`(${escapeRegExp(trimmed)})`, "ig");
  const parts = text.split(pattern).filter(Boolean);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <Text key={`${part}-${index}`} style={[style, styles.highlight, highlightStyle]}>
            {part}
          </Text>
        ) : (
          <Text key={`${part}-${index}`}>{part}</Text>
        )
      )}
    </Text>
  );
}

const styles = {
  highlight: {
    color: colors.accent,
    fontWeight: "700" as const,
    backgroundColor: colors.accentMuted,
  },
};
