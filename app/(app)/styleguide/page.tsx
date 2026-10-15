import { CalendarDays, PawPrint, Plus, Scissors, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { OverlayDemos, ToastDemos } from "@/components/styleguide/demos";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GroomerChip } from "@/components/ui/groomer-chip";
import { FieldError, FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("styleguide");
  return { title: t("title") };
}

// Token name → Tailwind class that paints it. Names are code, not UI text.
const COLOR_TOKENS: [string, string][] = [
  ["--background", "bg-background"],
  ["--surface", "bg-surface"],
  ["--surface-muted", "bg-surface-muted"],
  ["--sidebar", "bg-sidebar"],
  ["--foreground", "bg-foreground"],
  ["--foreground-soft", "bg-foreground-soft"],
  ["--muted", "bg-muted"],
  ["--border", "bg-border"],
  ["--input", "bg-input"],
  ["--primary", "bg-primary"],
  ["--primary-soft", "bg-primary-soft"],
  ["--danger", "bg-danger"],
  ["--danger-soft", "bg-danger-soft"],
  ["--info-soft", "bg-info-soft"],
  ["--success-soft", "bg-success-soft"],
  ["--warning-soft", "bg-warning-soft"],
];

const RADII: [string, string][] = [
  ["sm · 6", "rounded-sm"],
  ["md · 10", "rounded-md"],
  ["lg · 14", "rounded-lg"],
  ["xl · 20", "rounded-xl"],
];

// Seed colours plus a few the owner might pick, to prove legibility.
const GROOMER_SAMPLES: [string, string][] = [
  ["Meistrė A", "#0d9488"],
  ["Meistrė B", "#d97706"],
  ["Meistrė C", "#7c3aed"],
  ["Meistrė D", "#e11d48"],
  ["Meistrė E", "#facc15"],
  ["Meistrė F", "#1e293b"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-muted text-xs font-semibold tracking-wider uppercase">{title}</h3>
      {children}
    </section>
  );
}

async function Showcase({ theme }: { theme: "light" | "dark" }) {
  const t = await getTranslations("styleguide");
  const a = await getTranslations("auth");
  const id = (name: string) => `${theme}-${name}`;

  return (
    <div
      data-theme={theme}
      className="bg-background text-foreground border-border space-y-10 rounded-xl border p-4 sm:p-6"
    >
      <h2 className="font-display text-2xl font-semibold tracking-tight">{t(theme)}</h2>

      <Section title={t("colors")}>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
          {COLOR_TOKENS.map(([name, cls]) => (
            <li key={name} className="flex items-center gap-2">
              <span className={`${cls} ring-border-strong size-8 shrink-0 rounded-md ring-1`} aria-hidden />
              <code className="text-foreground-soft truncate text-xs">{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("typography")}>
        <div className="space-y-2">
          <p className="font-display text-3xl font-semibold tracking-tight">{t("sampleDisplay")}</p>
          <p className="text-muted text-xs">{t("typeDisplay")}</p>
          <p className="font-display text-[1.375rem] font-semibold tracking-tight">{t("typeTitle")}</p>
          <p className="text-base leading-relaxed">{t("typeBody")}</p>
          <p className="text-muted text-sm">{t("typeMeta")}</p>
          <p className="text-muted text-xs">{t("typeSmall")}</p>
        </div>
      </Section>

      <Section title={t("radius")}>
        <div className="flex flex-wrap gap-3">
          {RADII.map(([label, cls]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className={`${cls} border-border-strong bg-surface size-14 border`} />
              <span className="text-muted text-xs tabular-nums">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("elevation")}>
        <div className="grid grid-cols-3 gap-3">
          <div className="border-border bg-surface h-16 rounded-lg border" />
          <div className="border-border bg-surface h-16 rounded-lg border shadow-sm" />
          <div className="border-border bg-surface h-16 rounded-lg border shadow-lg" />
        </div>
      </Section>

      <Section title={t("buttons")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <Plus aria-hidden />
            {t("primary")}
          </Button>
          <Button variant="secondary">{t("secondary")}</Button>
          <Button variant="soft">{t("primary")}</Button>
          <Button variant="ghost">{t("ghost")}</Button>
          <Button variant="danger">
            <Trash2 aria-hidden />
            {t("danger")}
          </Button>
          <Button variant="link">{t("link")}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary">
            {t("secondary")}
          </Button>
          <Button size="lg">{t("primary")}</Button>
          <Button loading>{t("loading")}</Button>
          <Button disabled variant="secondary">
            {t("disabled")}
          </Button>
          <Button size="icon" variant="secondary" aria-label={t("primary")}>
            <Plus aria-hidden />
          </Button>
          {/* FAB as used on the phone calendar in week 2 */}
          <Button size="icon" className="size-14 rounded-full shadow-lg" aria-label={t("sheetTitle")}>
            <Plus aria-hidden />
          </Button>
        </div>
      </Section>

      <Section title={t("forms")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={id("name")}>{t("clientName")}</Label>
            <Input id={id("name")} placeholder={t("clientNamePlaceholder")} />
          </div>
          <div>
            <Label htmlFor={id("phone")}>{t("phone")}</Label>
            <Input
              id={id("phone")}
              type="tel"
              inputMode="tel"
              defaultValue="+370 612"
              aria-invalid
              aria-describedby={id("phone-error")}
            />
            <FieldError id={id("phone-error")} message={t("fieldErrorSample")} />
          </div>
          <div>
            <Label htmlFor={id("species")}>{t("species")}</Label>
            <Select id={id("species")} defaultValue="dog">
              <option value="dog">{t("dog")}</option>
              <option value="cat">{t("cat")}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={id("password")}>{a("newPassword")}</Label>
            <PasswordInput id={id("password")} defaultValue="smilo-demo" aria-describedby={id("pw-hint")} />
            <FieldHint id={id("pw-hint")}>{a("newPasswordHint")}</FieldHint>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={id("notes")}>{t("notes")}</Label>
            <Textarea id={id("notes")} placeholder={t("notesPlaceholder")} />
          </div>
        </div>
      </Section>

      <Section title={t("badges")}>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="scheduled" />
          <StatusBadge status="completed" />
          <StatusBadge status="cancelled" />
          <StatusBadge status="no_show" />
          <Badge tone="primary">{t("primary")}</Badge>
          <Badge tone="outline">{t("secondary")}</Badge>
        </div>
      </Section>

      <Section title={t("cards")}>
        <Card>
          <CardContent className="flex items-start gap-3">
            <Avatar name="Maksas" icon={<PawPrint />} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t("cardTitle")}</p>
              <p className="text-muted text-sm tabular-nums">{t("cardMeta")}</p>
              <p className="text-foreground-soft mt-2 text-sm">{t("cardBody")}</p>
            </div>
            <p className="font-semibold tabular-nums">{t("cardPrice")}</p>
          </CardContent>
          <CardFooter className="justify-between">
            <GroomerChip name="Meistrė A" color="#0d9488" />
            <StatusBadge status="completed" />
          </CardFooter>
        </Card>
      </Section>

      <Section title={t("avatars")}>
        <div className="flex flex-wrap items-center gap-2">
          <Avatar name={t("petsOf")} size="sm" />
          <Avatar name={t("petsOf")} />
          <Avatar name="Jonas Kazlauskas" size="lg" />
          <Avatar name="Žuikis" icon={<PawPrint />} />
          <Avatar name="Ūla" />
          <Avatar name="Čiuožėjas" icon={<PawPrint />} />
        </div>
      </Section>

      <Section title={t("groomers")}>
        <div className="flex flex-wrap gap-2">
          {GROOMER_SAMPLES.map(([name, color]) => (
            <GroomerChip key={name} name={name} color={color} />
          ))}
        </div>
      </Section>

      <Section title={t("feedback")}>
        <div className="space-y-2">
          <Alert tone="success">{t("alertInfo")}</Alert>
          <Alert tone="danger">{t("alertDanger")}</Alert>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
          <Spinner className="text-muted" />
        </div>
        <ToastDemos />
      </Section>

      <Section title={t("overlays")}>
        <OverlayDemos idPrefix={theme} />
      </Section>

      <Section title={t("emptyStates")}>
        <Card>
          <EmptyState
            headingLevel={3}
            icon={CalendarDays}
            title={t("emptyTitle")}
            description={t("emptyText")}
            action={
              <Button>
                <Scissors aria-hidden />
                {t("sheetTitle")}
              </Button>
            }
          />
        </Card>
      </Section>
    </div>
  );
}

export default async function StyleguidePage() {
  const t = await getTranslations("styleguide");
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="mx-auto w-full max-w-[90rem] space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <p className="text-muted max-w-2xl text-base">{t("intro")}</p>
        <div className="grid gap-4 xl:grid-cols-2">
          <Showcase theme="light" />
          <Showcase theme="dark" />
        </div>
      </div>
    </>
  );
}
