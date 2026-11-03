import { useHydrated } from "../../lib/use-hydrated";
import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { X, Check } from "lucide-react";
import { IconButton } from "./primitives";

type DialogProps = {
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  kind?: "dialog" | "sheet";
};
export function Dialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
  kind = "dialog",
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="overlay" />
        <DialogPrimitive.Content className={`dialog dialog--${kind}`}>
          <div className="sheet-handle" aria-hidden="true" />
          <DialogPrimitive.Title className="dialog-title">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="dialog-description">
            {description}
          </DialogPrimitive.Description>
          {children}
          <DialogPrimitive.Close asChild>
            <IconButton label="Fermer" className="dialog-close">
              <X size={20} />
            </IconButton>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Sheet(props: Omit<DialogProps, "kind">) {
  return <Dialog {...props} kind="sheet" />;
}
export function Tooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: string;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="tooltip" sideOffset={6}>
            {content}
            <TooltipPrimitive.Arrow className="tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
export function Dropdown({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: {
    label: string;
    onSelect: () => void;
    disabled?: boolean;
    selected?: boolean;
  }[];
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          className="dropdown"
          sideOffset={8}
          align="end"
        >
          {items.map((item) => (
            <DropdownPrimitive.Item
              className="dropdown-item"
              key={item.label}
              onSelect={item.onSelect}
              disabled={item.disabled}
            >
              {item.label}
              {item.selected && <Check size={16} aria-hidden="true" />}
            </DropdownPrimitive.Item>
          ))}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}
export function Tabs({
  label,
  tabs,
}: {
  label: string;
  tabs: { value: string; label: string; content: ReactNode }[];
}) {
  const hydrated = useHydrated();
  return (
    <TabsPrimitive.Root defaultValue={tabs[0]?.value}>
      <TabsPrimitive.List className="tabs" aria-label={label}>
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            className="tab"
            disabled={!hydrated}
            key={tab.value}
            value={tab.value}
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content
          className="tab-panel"
          key={tab.value}
          value={tab.value}
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
