/**
 * shadcn/ui `separator` — variante BASE (registre `base-nova`, primitive
 * @base-ui/react/separator), recopié via le CLI (alias réécrits en `~/…`
 * par components.json), sans autre adaptation :
 *  - audit des variantes `data-*` : `data-horizontal:`/`data-vertical:`
 *    sont des attributs présence-seule de Base UI (un seul des deux à la
 *    fois) — pas de bug `data-…="false"` à la cmdk, rien à corriger.
 * Le `data-slot` du registre est conservé. Ajouté comme dépendance de
 * `sidebar` (SidebarSeparator).
 */

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "~/lib/cn";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className
      )}
      data-slot="separator"
      orientation={orientation}
      {...props}
    />
  );
}

export { Separator };
