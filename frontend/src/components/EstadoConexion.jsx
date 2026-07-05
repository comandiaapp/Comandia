import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

import { useConnectivity } from '../context/ConnectivityContext';

function formatearUltimaSync(fecha) {
  if (!fecha) return 'Todavía no';
  const minutos = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60000));
  if (minutos === 0) return 'Hace un momento';
  if (minutos === 1) return 'Hace 1 minuto';
  return `Hace ${minutos} minutos`;
}

function EstadoConexion() {
  const conectividad = useConnectivity();
  const [mostrarInfo, setMostrarInfo] = useState(false);

  if (!conectividad) return null;
  const { online, sincronizando, ultimaSync, resumen } = conectividad;

  const color = sincronizando ? 'var(--accent)' : online ? 'var(--success)' : 'var(--error)';
  const Icono = sincronizando ? RefreshCw : online ? Wifi : WifiOff;
  const texto = sincronizando ? 'Sincronizando...' : online ? 'En línea' : 'Sin conexión — modo offline';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMostrarInfo((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg bg-[var(--bg-sidebar-hover)] px-3 py-2 text-xs font-medium text-[var(--text-sidebar)]"
      >
        <Icono size={14} className={sincronizando ? 'animate-spin' : ''} style={{ color }} />
        <span>{texto}</span>
        {resumen.pendientes > 0 && (
          <span className="ml-auto rounded-full bg-[var(--warning)] px-1.5 py-0.5 text-[10px] font-bold text-black">
            {resumen.pendientes}
          </span>
        )}
      </button>

      {mostrarInfo && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-full rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] p-3 text-xs text-[var(--text-sidebar)] shadow-xl">
          <p>Último sync: {formatearUltimaSync(ultimaSync)}</p>
          <p className="mt-1">
            {resumen.pendientes} cambio{resumen.pendientes === 1 ? '' : 's'} pendiente
            {resumen.pendientes === 1 ? '' : 's'} de sincronizar
          </p>
          {resumen.conError > 0 && (
            <p className="mt-1 text-[var(--error)]">{resumen.conError} con error, revisa la conexión</p>
          )}
        </div>
      )}
    </div>
  );
}

export default EstadoConexion;
