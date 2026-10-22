import { useEffect, useState } from "react";

/** Fecha y hora actuales (se actualiza cada segundo), para comparar con las horas de apertura. */
export function CurrentDateTime() {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fecha = ahora.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const hora = ahora.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <p className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
      <span className="first-letter:uppercase">{fecha}</span>, {hora}
    </p>
  );
}
