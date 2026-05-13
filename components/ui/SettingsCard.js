import Card from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * Reusable settings section card. Header shows an icon + title +
 * subtitle; body holds the form/toggles. The `tone` prop renders a
 * red-accented variant for the danger zone.
 */
export default function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  action,
  tone = "default", // "default" | "danger"
}) {
  const isDanger = tone === "danger";

  return (
    <Card padding="none" className={cn(isDanger && "border-red-200 bg-red-50/30")}>
      <div
        className={cn(
          "px-6 pt-6 pb-4 border-b flex items-start justify-between gap-4",
          isDanger ? "border-red-200" : "border-slate-100"
        )}
      >
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div
              className={cn(
                "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5",
                isDanger
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4",
                  isDanger ? "text-red-500" : "text-[#0052FF]"
                )}
              />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-heading text-slate-900 tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </Card>
  );
}
