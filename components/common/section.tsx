import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ title, description, actions, children, className, testId }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={cn("rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgba(27,42,65,0.04)]", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
