import { useState } from "react";
import { ImageLightbox } from "../../components/ImageLightbox";

const PLANOS = [
  { planta: "3ª Planta", src: "/Planta3.jpg" },
  { planta: "4ª Planta", src: "/Planta4.jpg" },
  { planta: "5ª Planta", src: "/Planta5.jpg" },
];

export function FloorPlans() {
  const [ampliado, setAmpliado] = useState<{ src: string; planta: string } | null>(null);

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Planos de BP "Adolfo Suárez" con la numeración de fila y asiento de cada sala. Toca una imagen para verla más
        grande.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANOS.map((p) => (
          <button
            key={p.planta}
            type="button"
            onClick={() => setAmpliado(p)}
            className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="overflow-hidden bg-slate-50 dark:bg-slate-900">
              <img
                src={p.src}
                alt={`Plano de ${p.planta}`}
                className="aspect-[3/2] w-full cursor-zoom-in object-cover transition group-hover:scale-105"
              />
            </div>
            <p className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              BP "Adolfo Suárez" · {p.planta}
            </p>
          </button>
        ))}
      </div>

      {ampliado && (
        <ImageLightbox src={ampliado.src} alt={`Plano de ${ampliado.planta}`} onClose={() => setAmpliado(null)} />
      )}
    </div>
  );
}
