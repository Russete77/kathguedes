import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-body font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-pink text-white rounded-full shadow-pink hover:bg-pink-light hover:shadow-[0_0_40px_rgba(255,0,128,0.6)] hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-pink focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
        secondary:
          "bg-transparent text-pink border border-pink rounded-full hover:bg-pink-dim focus-visible:ring-2 focus-visible:ring-pink focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
        ghost:
          "bg-bg-2 text-white border border-gray-4 rounded-full hover:border-gray-3 focus-visible:ring-2 focus-visible:ring-gray-3 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
        icon: "bg-bg-2 text-white border border-gray-4 rounded-full hover:border-pink hover:text-pink focus-visible:ring-2 focus-visible:ring-pink focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
        destructive:
          "bg-danger/10 text-danger border border-danger/25 rounded-full hover:bg-danger/20 focus-visible:ring-2 focus-visible:ring-danger",
        link: "text-pink underline-offset-4 hover:underline",
      },
      size: {
        sm: "px-5 py-2 text-xs",
        md: "px-7 py-3 text-sm",
        lg: "px-10 py-[18px] text-base",
        xl: "px-13 py-[22px] text-lg tracking-wide",
        icon: "w-12 h-12 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
