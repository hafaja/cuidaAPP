// netlify/functions/reviewer.js
// Acceso temporal para evaluadores (p. ej. OMS / GDO KE Platform).
// No toca las compras de Google Play. Se apaga borrando REVIEWER_CODE en Netlify.
//
// Variables de entorno en Netlify:
//   REVIEWER_CODE     → ej. "GDO-2026-K7Q4"
//   REVIEWER_EXPIRES  → ej. "2027-01-31"

const crypto = require('crypto');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido' });
  }

  const realCode = process.env.REVIEWER_CODE;
  const expires = process.env.REVIEWER_EXPIRES;
  if (!realCode || !expires) {
    return json(403, { ok: false, error: 'Acceso de evaluador desactivado' });
  }

  if (new Date() > new Date(expires + 'T23:59:59Z')) {
    return json(403, { ok: false, error: 'Acceso de evaluador caducado' });
  }

  let code = '';
  try { code = String(JSON.parse(event.body || '{}').code || '').trim(); }
  catch (e) { return json(400, { ok: false, error: 'JSON inválido' }); }

  const a = Buffer.from(code);
  const b = Buffer.from(realCode);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    return json(401, { ok: false, error: 'Código no válido' });
  }

  return json(200, { ok: true, role: 'reviewer', expires: expires, aiLimit: 30 });
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(obj)
  };
}
