"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input dedicado para placa de moto.
 *
 * Garante uppercase em **3 níveis** (defesa em camadas):
 *  - visual via classe `uppercase` (texto já aparece grande)
 *  - valor real via `onInput` que faz `target.value.toUpperCase()` mesmo
 *    quando o usuário cola texto em minúsculas (uncontrolled)
 *  - valor controlado via `onChange` interceptado quando o caller passa
 *    `value` + `onValueChange`
 *
 * Suporta ambos os padrões: controlled (`value` + `onValueChange`) e
 * uncontrolled (`defaultValue`). Todos os outros props HTML padrão chegam ao
 * <input> via spread.
 */
export type PlateInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  /** Valor controlado (caller mantém estado). */
  value?: string;
  /** Callback para valor controlado já em uppercase. */
  onValueChange?: (uppercaseValue: string) => void;
};

export const PlateInput = React.forwardRef<HTMLInputElement, PlateInputProps>(
  function PlateInput(
    {
      className,
      value,
      onValueChange,
      defaultValue,
      placeholder = "ABC1D23",
      maxLength = 10,
      autoComplete = "off",
      ...rest
    },
    ref,
  ) {
    const isControlled = value !== undefined;

    // Uncontrolled: força uppercase no DOM via onInput
    function handleInput(e: React.FormEvent<HTMLInputElement>) {
      const el = e.currentTarget;
      const upper = el.value.toUpperCase();
      if (el.value !== upper) {
        // Preserva caret position quando possível
        const start = el.selectionStart;
        const end = el.selectionEnd;
        el.value = upper;
        if (start !== null && end !== null) {
          try {
            el.setSelectionRange(start, end);
          } catch {
            // alguns input types não permitem; ignorar
          }
        }
      }
      // Encaminha ao caller se existir (ex.: validação no walkin)
      if (isControlled && onValueChange) onValueChange(upper);
    }

    // Controlled: garante que o valor exibido também esteja em uppercase
    const displayValue = isControlled ? value!.toUpperCase() : undefined;

    return (
      <input
        ref={ref}
        type="text"
        value={displayValue}
        defaultValue={isControlled ? undefined : (defaultValue as string | undefined)}
        onInput={handleInput}
        onChange={() => {
          /* noop — uppercase aplicado em onInput */
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode="text"
        autoCapitalize="characters"
        spellCheck={false}
        className={cn("uppercase tracking-wider", className)}
        {...rest}
      />
    );
  },
);
