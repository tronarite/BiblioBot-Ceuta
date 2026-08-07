import type { HorarioExtraordinario } from "../../api/types";

export function ExtraordinaryBanner({ horarios }: { horarios: HorarioExtraordinario[] }) {
  if (horarios.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="mb-2 text-sm font-semibold text-amber-800">Horarios extraordinarios</h2>
      <ul className="space-y-1 text-sm text-amber-900">
        {horarios.map((h) => (
          <li key={h.id}>
            <span className="font-medium">{h.biblioteca.nombre}</span> ·{" "}
            {new Date(h.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "long" })} — {h.descripcion} ({h.horario})
          </li>
        ))}
      </ul>
    </div>
  );
}
