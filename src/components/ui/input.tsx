import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

function Input({ className, label, hint, error, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor={id}
          className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "bg-bg-1 border border-gray-4 rounded-[8px] text-white font-body text-[15px]",
          "px-4 py-3.5 outline-none transition-all duration-200",
          "placeholder:text-gray-3",
          "focus:border-pink focus:ring-[3px] focus:ring-pink-dim",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-danger focus:ring-danger/10",
          className
        )}
        {...props}
      />
      {error && (
        <span className="text-[12px] text-danger/80">{error}</span>
      )}
      {hint && !error && (
        <span className="text-[12px] text-gray-3">{hint}</span>
      )}
    </div>
  );
}

export { Input };
