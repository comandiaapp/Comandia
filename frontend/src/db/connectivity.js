const baseURL = import.meta.env.VITE_API_URL || '';
const INTERVALO_PING_MS = 30000;
const TIMEOUT_PING_MS = 5000;

class ConnectivityService {
  constructor() {
    this.online = navigator.onLine;
    this.listeners = [];

    window.addEventListener('online', () => this.verificarConexion());
    window.addEventListener('offline', () => this.actualizarEstado(false));

    setInterval(() => this.verificarConexion(), INTERVALO_PING_MS);
  }

  async verificarConexion() {
    try {
      const controlador = new AbortController();
      const timeoutId = setTimeout(() => controlador.abort(), TIMEOUT_PING_MS);
      const respuesta = await fetch(`${baseURL}/health`, {
        method: 'GET',
        cache: 'no-cache',
        signal: controlador.signal,
      });
      clearTimeout(timeoutId);
      this.actualizarEstado(respuesta.ok);
    } catch {
      this.actualizarEstado(false);
    }
  }

  actualizarEstado(nuevoEstado) {
    const volvioOnline = nuevoEstado && !this.online;
    this.online = nuevoEstado;
    this.notificar(nuevoEstado);
    if (volvioOnline) this.sincronizar();
  }

  onCambio(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  notificar(estado) {
    this.listeners.forEach((l) => l(estado));
  }

  async sincronizar() {
    const { syncService } = await import('./syncService');
    await syncService.sincronizarTodo();
  }
}

export const connectivity = new ConnectivityService();
export default connectivity;
