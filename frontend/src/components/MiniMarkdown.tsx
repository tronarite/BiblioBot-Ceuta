import { Fragment, type ReactNode } from "react";

/**
 * Renderizador de Markdown minimalista (sin dependencias, para mantener el proyecto
 * ligero): negrita, cursiva, saltos de línea, párrafos y listas con "- ". No procesa
 * HTML crudo del texto en ningún momento, así que es seguro con contenido de admins.
 */
function renderInline(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return partes.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**")) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>;
    }
    if (parte.startsWith("*") && parte.endsWith("*")) {
      return <em key={i}>{parte.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{parte}</Fragment>;
  });
}

export function MiniMarkdown({ texto, className }: { texto: string; className?: string }) {
  const bloques = texto.trim().split(/\n{2,}/);

  return (
    <div className={className}>
      {bloques.map((bloque, i) => {
        const lineas = bloque.split("\n");
        const esLista = lineas.every((l) => /^[-*]\s+/.test(l.trim()));
        if (esLista) {
          return (
            <ul key={i} className="list-disc space-y-0.5 pl-5">
              {lineas.map((l, j) => (
                <li key={j}>{renderInline(l.trim().replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lineas.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
