"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ComboOption = { value: string; label: string };

/**
 * Combo de selección con búsqueda (estándar del proyecto).
 * Reemplaza a los <select> nativos: se puede tipear para filtrar las opciones.
 * Controlado: value = string ("" = sin selección), onChange(value).
 */
export default function Combobox({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  disabled = false,
  allowClear = true,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t));
  }, [q, options]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    setHi(0);
  }, [q, open]);

  function pick(o: ComboOption) {
    onChange(o.value);
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div
        className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white flex items-center gap-2 focus-within:border-marca"
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <input
          ref={inputRef}
          disabled={disabled}
          className="flex-1 outline-none bg-transparent min-w-0 text-sm"
          placeholder={selected ? "" : placeholder}
          value={open ? q : selected?.label ?? ""}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQ("");
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHi((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (open && filtered[hi]) {
                e.preventDefault();
                pick(filtered[hi]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setQ("");
            }
          }}
        />
        {allowClear && selected && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Limpiar"
            className="text-gray-400 hover:text-gray-600 text-sm leading-none px-1"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQ("");
              setOpen(false);
            }}
          >
            ✕
          </button>
        )}
        <span className="text-gray-400 text-xs select-none">▾</span>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>
          )}
          {filtered.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setHi(i)}
              className={`block w-full text-left px-3 py-2 text-sm ${
                i === hi ? "bg-gray-100" : ""
              } ${o.value === value ? "text-marca font-medium" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
