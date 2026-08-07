import { useState } from "react";

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [tamanoReal, setTamanoReal] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="mb-3 flex shrink-0 items-center justify-between text-white">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTamanoReal((v) => !v);
          }}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
        >
          {tamanoReal ? "Ajustar a la pantalla" : "Ver a tamaño real"}
        </button>
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20" aria-label="Cerrar">
          Cerrar ✕
        </button>
      </div>

      <div
        className={`flex-1 ${tamanoReal ? "overflow-auto" : "overflow-hidden"} flex items-center justify-center`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          onClick={() => setTamanoReal((v) => !v)}
          className={
            tamanoReal
              ? "max-w-none cursor-zoom-out"
              : "max-h-full max-w-full cursor-zoom-in object-contain"
          }
        />
      </div>
    </div>
  );
}
