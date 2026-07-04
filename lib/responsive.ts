import { useWindowDimensions } from "react-native";

/** Calendar tab switches to side-by-side layout at this width (tablet / desktop web). */
export const CALENDAR_WIDE_BREAKPOINT = 768;

export function useCalendarWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= CALENDAR_WIDE_BREAKPOINT;
}
