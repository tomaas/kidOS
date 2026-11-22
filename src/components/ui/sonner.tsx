import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";
import type { ToasterProps } from "sonner";

const Toaster = ({ theme = "system", ...props }: ToasterProps) => (
  <Sonner
    className="toaster group"
    style={
      {
        "--normal-bg": "var(--popover)",
        "--normal-border": "var(--border)",
        "--normal-text": "var(--popover-foreground)",
      } as CSSProperties
    }
    theme={theme}
    {...props}
  />
);

export { Toaster };
