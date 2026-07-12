const ANCHO_MAXIMO = 800;
const CALIDAD = 0.82;

// Redimensiona una imagen en el navegador con Canvas (nativo, sin
// dependencias — funciona igual en el WebView de Tauri) y la devuelve como
// data URL jpeg. Evita que un archivo sin comprimir (foto de celular, varios
// MB) infle la base local o la sync_queue mientras el producto está
// pendiente de sincronizar.
export function redimensionarImagen(archivo, anchoMaximo = ANCHO_MAXIMO, calidad = CALIDAD) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const imagen = new Image();
      imagen.onerror = () => reject(new Error('El archivo no es una imagen válida'));
      imagen.onload = () => {
        const escala = Math.min(1, anchoMaximo / imagen.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(imagen.width * escala);
        canvas.height = Math.round(imagen.height * escala);
        canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      imagen.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}
