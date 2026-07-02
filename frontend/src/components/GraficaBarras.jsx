import { formatearPrecio } from '../utils/formato';

// Gráfica de barras en CSS puro, sin librerías externas. `datos` es un
// arreglo de { label, valor }; la altura de cada barra es proporcional al
// valor más alto del conjunto.
function GraficaBarras({ datos, alturaPx = 180 }) {
  if (datos.length === 0) {
    return <p className="py-8 text-center text-sm text-[#a1a1aa]">No hay ventas para mostrar todavía.</p>;
  }

  const maximo = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ height: alturaPx + 50 }}>
      {datos.map((dato) => (
        <div key={dato.label} className="flex min-w-[40px] flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-medium text-[#a1a1aa]">{formatearPrecio(dato.valor)}</span>
          <div
            className="w-full rounded-t-md bg-[#f97316] transition-all"
            style={{ height: Math.max(4, (dato.valor / maximo) * alturaPx) }}
          />
          <span className="text-[11px] text-[#a1a1aa]">{dato.label}</span>
        </div>
      ))}
    </div>
  );
}

export default GraficaBarras;
