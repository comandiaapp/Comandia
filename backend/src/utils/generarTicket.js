// Genera el HTML de la factura electrónica de venta (formato DIAN) y de la
// precuenta, en formato de tirilla POS de 80mm con fuente monoespaciada
// para que las columnas queden alineadas tanto en pantalla como al imprimir.

const ANCHO = 40;
const COL_REG = 4;
const COL_DESC = 15;
const COL_CANT = 5;
const COL_VUNIT = 8;
const COL_TOTAL = 8;

function moneda(valor) {
  const entero = Math.round(Number(valor) || 0);
  const texto = Math.abs(entero).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (entero < 0 ? '-$' : '$') + texto;
}

function centrar(texto, ancho = ANCHO) {
  const str = String(texto);
  if (str.length >= ancho) return str.slice(0, ancho);
  const espacio = ancho - str.length;
  const izq = Math.floor(espacio / 2);
  return ' '.repeat(izq) + str + ' '.repeat(espacio - izq);
}

function fila(izquierda, derecha, ancho = ANCHO) {
  const izq = String(izquierda);
  const der = String(derecha);
  const espacio = Math.max(1, ancho - izq.length - der.length);
  return izq + ' '.repeat(espacio) + der;
}

function separador(char = '─', ancho = ANCHO) {
  return char.repeat(ancho);
}

function encabezadoItems() {
  return (
    'Reg'.padEnd(COL_REG) +
    'Descripción'.padEnd(COL_DESC) +
    'Cant'.padStart(COL_CANT) +
    'V.Unit'.padStart(COL_VUNIT) +
    'Total'.padStart(COL_TOTAL)
  );
}

// Cada item se imprime con su número de línea (Reg) y nombre (envuelto en
// varias líneas si no cabe en la columna de descripción), con cantidad,
// precio unitario y subtotal alineados a la derecha en la última línea.
function filaItem(item, numero) {
  const regTxt = String(numero).padEnd(COL_REG);
  const palabras = String(item.nombre_producto).split(' ');
  const lineasDesc = [];
  let actual = '';
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length > COL_DESC && actual) {
      lineasDesc.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  }
  if (actual) lineasDesc.push(actual);
  if (lineasDesc.length === 0) lineasDesc.push('');

  const lineas = [];
  lineasDesc.forEach((desc, idx) => {
    const prefijo = idx === 0 ? regTxt : ' '.repeat(COL_REG);
    if (idx === lineasDesc.length - 1) {
      const cant = `${item.cantidad}x`.padStart(COL_CANT);
      const vunit = moneda(item.precio_unitario).padStart(COL_VUNIT);
      const total = moneda(item.subtotal).padStart(COL_TOTAL);
      lineas.push(prefijo + desc.padEnd(COL_DESC) + cant + vunit + total);
    } else {
      lineas.push(
        prefijo + desc.padEnd(COL_DESC) + ' '.repeat(COL_CANT) + ' '.repeat(COL_VUNIT) + ' '.repeat(COL_TOTAL)
      );
    }
  });

  for (const mod of item.modificadores || []) {
    lineas.push(' '.repeat(COL_REG) + `+ ${mod.nombre_opcion}`.slice(0, ANCHO - COL_REG));
  }
  if (item.notas) {
    lineas.push(' '.repeat(COL_REG) + `"${item.notas}"`.slice(0, ANCHO - COL_REG));
  }

  return lineas.join('\n');
}

// Determina el texto de responsabilidad fiscal según el régimen y si la
// tarifa aplicada corresponde al Impuesto Nacional al Consumo (8%, el valor
// que usa esta app para restaurantes no franquicia) o al IVA.
function textoResponsabilidadFiscal(restaurante, impuestoPorcentaje) {
  if (Number(impuestoPorcentaje) === 8) {
    return 'RESPONSABLE DEL IMPUESTO NACIONAL AL CONSUMO';
  }
  return restaurante.regimen === 'comun' ? 'RESPONSABLE DE IVA' : 'NO RESPONSABLE DEL IVA';
}

function escaparHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatearFechaHora(fecha) {
  const d = new Date(fecha);
  const fechaTxt = d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaTxt = d.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${fechaTxt} ${horaTxt}`;
}

// fecha_resolucion_dian es una columna DATE (sin hora): se formatea leyendo
// los componentes UTC directamente para no correrse un día al convertir a
// America/Bogota, que es lo que pasaría con un new Date('2023-01-01') al
// interpretarlo como medianoche UTC y luego mostrarlo en UTC-5.
function formatearFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const anio = d.getUTCFullYear();
  return `${dia}/${mes}/${anio}`;
}

const NIT_SIN_FORMATO = /^(\d+)-?(\d)?$/;

function formatearNit(nit) {
  if (!nit) return '';
  const match = String(nit).match(NIT_SIN_FORMATO);
  if (!match) return nit;
  const [, numero, verificacion] = match;
  const numeroFormateado = numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return verificacion ? `${numeroFormateado}-${verificacion}` : numeroFormateado;
}

function envolverHTML(texto, { titulo }) {
  return `<div style="font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.35; width: 80mm; padding: 6px; box-sizing: border-box; white-space: pre-wrap; word-break: break-word;" aria-label="${escaparHTML(titulo)}"><pre style="margin:0; font-family: inherit; font-size: inherit; white-space: pre-wrap;">${escaparHTML(texto)}</pre></div>`;
}

function generarHTMLTicket(factura, restaurante, pedido, usuario) {
  const lineas = [];
  const prefijo = restaurante.prefijo_factura || 'FE';
  const numeroSinGuion = String(factura.numero_factura).replace(/-/g, '');

  lineas.push(centrar(restaurante.nombre || ''));
  if (restaurante.nit) lineas.push(centrar(`NIT: ${formatearNit(restaurante.nit)}`));
  lineas.push(centrar(`FACTURA DE VENTA ${numeroSinGuion}`));
  lineas.push(separador('═'));

  if (restaurante.direccion) lineas.push(`Dir: ${restaurante.direccion}`);
  if (restaurante.telefono) lineas.push(`Tel: ${restaurante.telefono}`);
  if (restaurante.ciudad || restaurante.departamento) {
    lineas.push([restaurante.ciudad, restaurante.departamento].filter(Boolean).join(', '));
  }
  lineas.push(textoResponsabilidadFiscal(restaurante, factura.impuesto_porcentaje));
  lineas.push('');

  lineas.push('Autorización Numeración de Facturación');
  if (restaurante.numero_resolucion_dian) {
    lineas.push(`No. Formulario: ${restaurante.numero_resolucion_dian}`);
  }
  if (restaurante.fecha_resolucion_dian) {
    lineas.push(`Vigente desde ${formatearFecha(restaurante.fecha_resolucion_dian)} - 24 meses`);
  }
  lineas.push('Numeración: AUTORIZADA');
  lineas.push(`Prefijo ${prefijo} del No. ${restaurante.factura_desde ?? 1} al ${restaurante.factura_hasta ?? 99999}`);
  lineas.push(`Fecha: ${formatearFechaHora(factura.fecha_emision)}`);
  lineas.push('Caja: Principal');
  lineas.push(`Turno: ${pedido.numero_jornada ?? pedido.numero_global ?? '-'}`);
  lineas.push(`Vendedor: ${usuario?.nombre || '-'}`);
  lineas.push('Cond. Pago: CONTADO');
  lineas.push(separador());

  lineas.push(`Cliente: ${factura.nombre_cliente}`);
  lineas.push(`NIT/CC: ${factura.nit_cliente}`);
  if (factura.email_cliente) lineas.push(`Correo: ${factura.email_cliente}`);
  lineas.push(separador());

  lineas.push(encabezadoItems());
  lineas.push(separador());
  let numeroItem = 0;
  for (const item of (pedido.items || []).filter((i) => i.estado !== 'cancelado')) {
    numeroItem++;
    lineas.push(filaItem(item, numeroItem));
  }
  lineas.push(separador());

  lineas.push(fila('SUBTOTAL:', moneda(factura.subtotal)));
  lineas.push(fila(`INC/IVA (${Number(factura.impuesto_porcentaje)}%):`, moneda(factura.impuesto_monto)));
  lineas.push(separador('═'));
  lineas.push(fila('TOTAL:', moneda(factura.total)));
  lineas.push(separador('═'));

  const propinaCobrada = Number(pedido.propina) || 0;
  if (propinaCobrada > 0) {
    lineas.push(fila('Propina (cobrada):', moneda(propinaCobrada)));
    lineas.push(fila('TOTAL CON PROPINA:', moneda(Number(factura.total) + propinaCobrada)));
  } else {
    lineas.push(fila('Propina sugerida (vol.):', moneda(factura.propina_sugerida)));
    lineas.push(fila('TOTAL CON PROPINA:', moneda(factura.total_con_propina)));
  }
  lineas.push('');

  lineas.push('Fabricante del Software: Comandia SAS');
  lineas.push('Software: Comandia POS v1.0');
  lineas.push('');

  lineas.push(`CUFE: ${factura.cufe}`);
  lineas.push('');
  lineas.push(centrar('[CÓDIGO QR]'));
  lineas.push('');

  if (restaurante.mensaje_ticket) {
    lineas.push(centrar(restaurante.mensaje_ticket));
    lineas.push('');
  }
  lineas.push(centrar('¡Gracias por su visita!'));
  lineas.push(separador('═'));

  return envolverHTML(lineas.join('\n'), { titulo: `Factura ${factura.numero_factura}` });
}

function generarHTMLPrecuenta(pedido, restaurante) {
  const lineas = [];

  lineas.push(centrar(restaurante.nombre || ''));
  lineas.push(centrar('PRE-CUENTA'));
  lineas.push(centrar('(Documento sin validez fiscal)'));
  lineas.push(separador('═'));

  if (restaurante.direccion) lineas.push(`Dir: ${restaurante.direccion}`);
  if (restaurante.telefono) lineas.push(`Tel: ${restaurante.telefono}`);
  lineas.push(`Pedido: #${String(pedido.numero_jornada ?? pedido.numero_global ?? '').padStart(2, '0')}`);
  if (pedido.mesa_numero) lineas.push(`Mesa: ${pedido.mesa_numero}`);
  lineas.push(`Fecha: ${formatearFechaHora(pedido.created_at || new Date())}`);
  lineas.push(separador());

  lineas.push(encabezadoItems());
  lineas.push(separador());
  let numeroItemPrecuenta = 0;
  for (const item of (pedido.items || []).filter((i) => i.estado !== 'cancelado')) {
    numeroItemPrecuenta++;
    lineas.push(filaItem(item, numeroItemPrecuenta));
  }
  lineas.push(separador());

  const subtotal = Number(pedido.subtotal) || 0;
  const descuento = Number(pedido.descuento) || 0;
  const impuesto = Number(pedido.impuesto) || 0;
  const propina = Number(pedido.propina) || 0;
  const total =
    pedido.total !== undefined ? Number(pedido.total) : Math.max(0, subtotal - descuento + impuesto + propina);

  lineas.push(fila('SUBTOTAL:', moneda(subtotal)));
  if (descuento > 0) lineas.push(fila('DESCUENTO:', `-${moneda(descuento)}`));
  if (impuesto > 0) lineas.push(fila('IMPUESTO:', moneda(impuesto)));
  if (propina > 0) lineas.push(fila('PROPINA:', moneda(propina)));
  lineas.push(separador('═'));
  lineas.push(fila('TOTAL:', moneda(total)));
  lineas.push(separador('═'));
  lineas.push('');
  lineas.push(centrar('Esta pre-cuenta no reemplaza la'));
  lineas.push(centrar('factura electrónica de venta.'));

  return envolverHTML(lineas.join('\n'), { titulo: 'Pre-cuenta' });
}

module.exports = { generarHTMLTicket, generarHTMLPrecuenta };
