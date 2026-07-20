import * as React from "react";
import { cn } from "@/lib/utils";

export type ToastProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  description: string;
};

export function Toast({ className, title, description, ...props }: ToastProps) {
  return (
    <div
      className={cn("rounded-md border bg-card p-4 text-card-foreground shadow-sm", className)}
      role="status"
      {...props}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
