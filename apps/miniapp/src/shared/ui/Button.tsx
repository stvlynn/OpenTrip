import { View } from "@tarojs/components";
import type { ITouchEvent } from "@tarojs/components";
import type { ReactNode } from "react";

import "./Button.scss";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

interface ButtonProps {
  children: ReactNode;
  onClick?: (event: ITouchEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  block?: boolean;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  block = false,
}: ButtonProps) {
  const classes = [
    "ot-button",
    `ot-button--${variant}`,
    `ot-button--${size}`,
    block ? "ot-button--block" : "",
    disabled ? "is-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View
      className={classes}
      hoverClass={disabled ? "none" : "ot-button--pressed"}
      hoverStartTime={0}
      hoverStayTime={80}
      onClick={(event) => {
        if (disabled) return;
        onClick?.(event);
      }}
    >
      {children}
    </View>
  );
}
