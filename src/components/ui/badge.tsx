import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase",
  {
    variants: {
      variant: {
        pink: "bg-pink-dim text-pink border border-pink/25",
        white: "bg-white/8 text-white border border-gray-4",
        green: "bg-success/10 text-success border border-success/25",
        yellow: "bg-yellow/10 text-yellow border border-yellow/25",
        solid: "bg-pink text-white",
        dark: "bg-bg-3 text-gray-1 border border-gray-4",
      },
    },
    defaultVariants: { variant: "pink" },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
