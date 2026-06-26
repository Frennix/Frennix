import { useRef } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type ScalePressableProps = PressableProps & {
  /** Scale when pressed. Default 0.97 */
  pressedScale?: number;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Spring scale feedback for tappable rows and cards — runs on the native driver. */
export function ScalePressable({
  children,
  style,
  containerStyle,
  pressedScale = 0.97,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: ScalePressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function animateTo(value: number) {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 48,
      bounciness: 4,
    }).start();
  }

  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled) animateTo(pressedScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!disabled) animateTo(1);
        onPressOut?.(event);
      }}
      style={style}
    >
      <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
