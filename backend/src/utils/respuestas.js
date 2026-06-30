function ok(res, datos = {}, status = 200) {
  return res.status(status).json({ ok: true, datos });
}

function error(res, mensaje, status = 400) {
  return res.status(status).json({ error: true, mensaje });
}

module.exports = { ok, error };
