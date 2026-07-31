/**
 * shadcn/ui `skeleton` — recopié via le CLI depuis le registre `base-nova`
 * (alias réécrits en `~/…` par components.json) puis adapté au projet :
 *  - `import type * as React` ajouté : le registre référence
 *    `React.ComponentProps` sans importer React (le site de docs l'injecte).
 * Le `data-slot` du registre est conservé. Ajouté comme dépendance de
 * `sidebar` (SidebarMenuSkeleton).
 */

import type * as React from "react";
import { cn } from "~/lib/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
