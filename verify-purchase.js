// netlify/functions/verify-purchase.js
//
// Verifica un purchaseToken de Google Play directamente contra los servidores
// de Google (Android Publisher API), en vez de confiar en lo que dice el cliente.
// Esto es lo que evita que alguien "falsifique" una compra desde el navegador/app.
//
// Requiere estas variables de entorno en Netlify (Site settings → Environment variables):
//   GOOGLE_SERVICE_ACCOUNT_JSON   → el contenido completo del JSON de la cuenta de servicio (como texto)
//   ANDROID_PACKAGE_NAME          → ej. "app.netlify.cuidarconsentido.twa"
//
// Requiere añadir la dependencia "googleapis" a package.json (ver instrucciones abajo).

const { google } = require('googleapis');

// IDs de producto que son suscripciones (el resto se tratan como compras únicas/consumibles)
const SUBSCRIPTION_SKUS = new Set(['consulta_mensual', 'licencia_residencia']);

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  let sku, purchaseToken;
  try {
    const body = JSON.parse(event.body || '{}');
    sku = body.sku;
    purchaseToken = body.purchaseToken;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  if (!sku || !purchaseToken) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan sku o purchaseToken' }) };
  }

  const packageName = process.env.ANDROID_PACKAGE_NAME;
  if (!packageName) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar ANDROID_PACKAGE_NAME' }) };
  }

  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Falta o es inválida GOOGLE_SERVICE_ACCOUNT_JSON' }) };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher']
    });
    const authClient = await auth.getClient();
    const androidpublisher = google.androidpublisher({ version: 'v3', auth: authClient });

    let valid = false;
    let details = null;

    if (SUBSCRIPTION_SKUS.has(sku)) {
      const res = await androidpublisher.purchases.subscriptions.get({
        packageName,
        subscriptionId: sku,
        token: purchaseToken
      });
      details = res.data;
      // paymentState: 1 = pago recibido, 2 = pendiente
      valid = details && (details.paymentState === 1 || details.paymentState === '1');
    } else {
      const res = await androidpublisher.purchases.products.get({
        packageName,
        productId: sku,
        token: purchaseToken
      });
      details = res.data;
      // purchaseState: 0 = comprado, 1 = cancelado, 2 = pendiente
      valid = details && (details.purchaseState === 0 || details.purchaseState === '0');
    }

    if (!valid) {
      return { statusCode: 402, body: JSON.stringify({ error: 'Compra no válida o pendiente', details }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sku, verifiedAt: new Date().toISOString() })
    };
  } catch (e) {
    console.error('Error verificando compra:', e && e.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error al verificar la compra con Google' }) };
  }
};
