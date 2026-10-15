"use client";

import { CalendarPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";

export function OverlayDemos({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("styleguide");
  const c = useTranslations("common");
  return (
    <div className="flex flex-wrap gap-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">
            <CalendarPlus aria-hidden />
            {t("openSheet")}
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("sheetTitle")}</SheetTitle>
            <SheetDescription>{t("sheetDescription")}</SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-4 pb-4">
            <div>
              <Label htmlFor={`${idPrefix}-sheet-client`}>{t("clientName")}</Label>
              <Input id={`${idPrefix}-sheet-client`} placeholder={t("clientNamePlaceholder")} />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-sheet-species`}>{t("species")}</Label>
              <Select id={`${idPrefix}-sheet-species`} defaultValue="dog">
                <option value="dog">{t("dog")}</option>
                <option value="cat">{t("cat")}</option>
              </Select>
            </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="secondary">{c("cancel")}</Button>
            </SheetClose>
            <SheetClose asChild>
              <Button>{c("save")}</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">{t("openDialog")}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{t("dialogKeep")}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="danger">{t("dialogConfirm")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ToastDemos() {
  const t = useTranslations("styleguide");
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        onClick={() => toast({ title: t("toastSaved"), description: t("toastSavedText"), tone: "success" })}
      >
        {t("showToastSuccess")}
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast({ title: t("toastError"), description: t("toastErrorText"), tone: "danger" })}
      >
        {t("showToastError")}
      </Button>
    </div>
  );
}
