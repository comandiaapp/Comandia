import { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { connectivity } from '../db/connectivity';
import { syncService } from '../db/syncService';
import { localDb } from '../db/database';

const ConnectivityContext = createContext(null);

export function ConnectivityProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [resumen, setResumen] = useState({ pendientes: 0, conError: 0 });

  const actualizarResumen = useCallback(async () => {
    await localDb.init();
    setResumen(await syncService.resumen());
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      await localDb.init();
      if (cancelado) return;
      await actualizarResumen();
      if (navigator.onLine) {
        setSincronizando(true);
        await syncService.sincronizarTodo();
        if (!cancelado) {
          setUltimaSync(new Date());
          setSincronizando(false);
          await actualizarResumen();
        }
      }
    }
    iniciar();

    const cancelarSuscripcion = connectivity.onCambio(async (estado) => {
      setOnline(estado);
      if (estado) {
        setSincronizando(true);
        await syncService.sincronizarTodo();
        setUltimaSync(new Date());
        setSincronizando(false);
        await actualizarResumen();
      }
    });

    return () => {
      cancelado = true;
      cancelarSuscripcion();
    };
  }, [actualizarResumen]);

  return (
    <ConnectivityContext.Provider value={{ online, sincronizando, ultimaSync, resumen }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}
