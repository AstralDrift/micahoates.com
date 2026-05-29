import { cn } from "@/lib/utils";

type LogoMarkProps = {
  className?: string;
  compact?: boolean;
};

export function LogoMark({ className, compact = false }: LogoMarkProps) {
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center border border-white/10 bg-white/[0.03] text-white shadow-[0_0_36px_rgba(73,221,255,0.12)]",
        compact ? "size-10 text-lg" : "size-12 text-xl",
        className
      )}
      aria-hidden="true"
    >
      <span className="absolute left-1 top-1 size-3 border-l-2 border-t-2 border-cyan-300" />
      <span className="absolute right-1 top-1 size-3 border-r-2 border-t-2 border-emerald-300" />
      <span className="absolute bottom-1 left-1 size-3 border-b-2 border-l-2 border-blue-400" />
      <span className="absolute bottom-1 right-1 size-3 border-b-2 border-r-2 border-violet-400" />
      <span className="translate-y-px font-semibold leading-none tracking-[0.04em]">M</span>
    </span>
  );
}
