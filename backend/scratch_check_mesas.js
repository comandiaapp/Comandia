const pool = require('./src/config/database');

pool
  .query(
    `SELECT r.nombre AS restaurante, m.numero, m.estado, a.nombre AS area, a.es_remota
     FROM mesas m
     JOIN restaurantes r ON r.id = m.restaurante_id
     LEFT JOIN areas a ON a.id = m.area_id
     WHERE m.numero ILIKE '%domicilio%' OR a.es_remota = true
     ORDER BY r.nombre, m.numero`
  )
  .then((res) => {
    console.log(JSON.stringify(res.rows, null, 2));
    return pool.end();
  })
  .catch((e) => {
    console.error(e.message);
    return pool.end();
  });
