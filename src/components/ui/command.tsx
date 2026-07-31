/**
 * shadcn/ui `command` — variante BASE (registre `base-nova`), recopiée depuis
 * le registre puis adaptée au projet :
 *  - `@/lib/utils` → `~/lib/cn` ;
 *  - `IconPlaceholder` (artefact du site de docs) → lucide-react ;
 *  - le champ de recherche : le registre l'enveloppe dans `<InputGroup>` /
 *    `<InputGroupAddon>` (composant `input-group`, dont AUCUN autre export ne
 *    servirait ici) — on inline l'équivalent, mêmes classes et mêmes
 *    `data-slot`, pour ne pas faire entrer un composant de plus dans l'arbre ;
 *  - `data-selected:` → `data-[selected=true]:` (CORRECTIF, vérifié au vrai
 *    runtime) : cmdk rend `data-selected="false"` sur les entrées NON
 *    sélectionnées, et la variante Tailwind `data-selected:` ne teste que la
 *    PRÉSENCE de l'attribut — telle quelle, toutes les entrées portaient le
 *    fond « sélectionné » et la surbrillance clavier était invisible. C'est
 *    l'orthographe qu'utilise déjà l'autre variante du registre (radix).
 * L'API publique (Command, CommandDialog, CommandInput, CommandList,
 * CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut)
 * est celle du registre : `CommandDialog` prend `<Command>` en ENFANT.
 *
 * Voir components/palette-parent.tsx pour le seul usage : la palette ⌘K de
 * l'espace parent.
 */

import { Command as CommandPrimitive } from "cmdk";
import { Check, Search } from "lucide-react";
import type * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/cn";

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
        className
      )}
      data-slot="command"
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0",
          className
        )}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="p-1 pb-0" data-slot="command-input-wrapper">
      {/* L'équivalent inline de <InputGroup> du registre (voir l'en-tête). */}
      <div
        className="group/input-group relative flex h-8 w-full min-w-0 items-center rounded-lg border border-input/30 bg-input/30 outline-none transition-colors has-[[data-slot=command-input]:focus-visible]:border-ring has-[[data-slot=command-input]:focus-visible]:ring-3 has-[[data-slot=command-input]:focus-visible]:ring-ring/50"
        role="group"
      >
        <CommandPrimitive.Input
          className={cn(
            "w-full bg-transparent pr-2 pl-1.5 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          data-slot="command-input"
          {...props}
        />
        <div
          className="order-first flex h-auto cursor-text select-none items-center justify-center gap-2 py-1.5 pl-2 font-medium text-muted-foreground text-sm"
          data-align="inline-start"
          data-slot="command-input-addon"
        >
          <Search className="size-4 shrink-0 opacity-50" />
        </div>
      </div>
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-y-auto overflow-x-hidden outline-none",
        className
      )}
      data-slot="command-list"
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn("py-6 text-center text-sm", className)}
      data-slot="command-empty"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:text-xs",
        className
      )}
      data-slot="command-group"
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("-mx-1 h-px bg-border", className)}
      data-slot="command-separator"
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "group/command-item relative flex cursor-default select-none items-center gap-2 in-data-[slot=dialog-content]:rounded-lg! rounded-sm px-2 py-1.5 text-sm outline-hidden data-[disabled=true]:pointer-events-none data-[selected=true]:bg-muted data-[selected=true]:text-foreground data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[selected=true]:*:[svg]:text-foreground",
        className
      )}
      data-slot="command-item"
      {...props}
    >
      {children}
      <Check className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-muted-foreground text-xs tracking-widest group-data-[selected=true]/command-item:text-foreground",
        className
      )}
      data-slot="command-shortcut"
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
