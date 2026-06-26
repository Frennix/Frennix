import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CirclePlus,
  Compass,
  Dumbbell,
  Home,
  MessagesSquare,
  Settings,
  SlidersHorizontal,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react-native";

export type AppIconName =
  | "feed"
  | "discover"
  | "events"
  | "post"
  | "messages"
  | "profile"
  | "settings"
  | "bell"
  | "chevron-left"
  | "chevron-right"
  | "users"
  | "sliders"
  | "dumbbell"
  | "check-circle"
  | "circle"
  | "compass"
  | "close";

const ICONS: Record<AppIconName, LucideIcon> = {
  feed: Home,
  discover: Compass,
  events: Calendar,
  post: CirclePlus,
  messages: MessagesSquare,
  profile: User,
  settings: Settings,
  bell: Bell,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  users: Users,
  sliders: SlidersHorizontal,
  dumbbell: Dumbbell,
  "check-circle": CircleCheck,
  circle: Circle,
  compass: Compass,
  close: X,
};

type AppIconProps = {
  name: AppIconName;
  color: string;
  size: number;
  strokeWidth?: number;
};

/** Lucide SVG icons — consistent across web, iOS Safari, Android, and native. */
export function AppIcon({ name, color, size, strokeWidth = 2 }: AppIconProps) {
  const Icon = ICONS[name];
  return <Icon color={color} size={size} strokeWidth={strokeWidth} />;
}
