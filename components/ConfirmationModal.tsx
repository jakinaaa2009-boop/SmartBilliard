"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Тийм",
  cancelLabel = "Болих",
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription className="mt-2">{description}</DialogDescription> : null}
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "destructive" : "default"}
            className="flex-1"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
