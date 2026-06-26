import {
  Calendar,
  CirclePlus,
  Compass,
  Home,
  MessagesSquare,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react-native";

export type TabBarIconName =
  | "feed"
  | "discover"
  | "events"
  | "post"
  | "messages"
  | "profile"
  | "settings";

const ICONS: Record<TabBarIconName, LucideIcon> = {
  feed: Home,
  discover: Compass,
  events: Calendar,
  post: CirclePlus,
  messages: MessagesSquare,
  profile: User,
  settings: Settings,
};

type TabBarIconProps = {
  name: TabBarIconName;
  color: string;
  size: number;
};

/** SVG tab icons — consistent across web, iOS Safari, Android, and native. */
export function TabBarIcon({ name, color, size }: TabBarIconProps) {
  const Icon = ICONS[name];
  return <Icon color={color} size={size} strokeWidth={2} />;
}
