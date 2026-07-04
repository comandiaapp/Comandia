import { formatearPrecio } from '../utils/formato';

const ANCHO_BARRA = 48;
const GAP_BARRAS = 12;
const ALTURA_MAXIMA = 200;

// Gráfica de barras en CSS puro, sin librerías externas. `datos` es un
// arreglo de { label, valor }. Cada barra tiene ancho fijo (no se estira
// para llenar el contenedor) y el conjunto hace scroll horizontal cuando no
// caben todas. La barra con el valor más alto se resalta en naranja brillante.
function GraficaBarras({ datos }) {
  if (datos.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--text-secondary)]">No hay ventas para mostrar todavía.</p>;
  }

  const maximo = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <div
      className="flex items-end overflow-x-auto pb-2"
      style={{ height: ALTURA_MAXIMA + 50, gap: GAP_BARRAS }}
    >
      {datos.map((dato) => {
        const esMaximo = dato.valor === maximo;
        return (
          <div
            key={dato.label}
            className="flex shrink-0 flex-col items-center justify-end gap-1"
            style={{ width: ANCHO_BARRA }}
          >
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">{formatearPrecio(dato.valor)}</span>
            <div
              className={`w-full rounded-t-md transition-all ${esMaximo ? 'bg-[var(--accent)]' : 'bg-[var(--accent)]/40'}`}
              style={{ height: Math.max(4, (dato.valor / maximo) * ALTURA_MAXIMA) }}
            />
            <span className="text-[11px] text-[var(--text-secondary)]">{dato.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default GraficaBarras;
