const LANG_NAMES = { es: "español", fr: "français", ca: "català", en: "English" };

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resp(405, { error: "Método no permitido" });
  }

  const apiKey = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return resp(500, { error: "Falta ANTHROPIC_KEY en el servidor" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return resp(400, { error: "JSON inválido" }); }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return resp(400, { error: "Faltan 'messages'" });
  }

  const idioma = LANG_NAMES[body.lang] || "español";
  const system =
    "Eres el asistente de cuidaAPP · CuidarConSentido, creado por Jean M. Vianney, " +
    "psicólogo gerontólogo especializado en deterioro cognitivo leve (DCL) y en el " +
    "acompañamiento a cuidadores de personas mayores. Respondes con rigor científico, " +
    "calidez y lenguaje claro. SIEMPRE respondes en " + idioma + ". " +
    "No das diagnósticos médicos: orientas y, cuando corresponde, recomiendas acudir a un " +
    "profesional. Devuelve SOLO HTML simple con estas etiquetas: <h3>, <p>, <ul>, <li>, <strong>. " +
    "Nada de markdown, nada de ```.";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system: system,
        messages: messages
      })
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || "Error de la API de Anthropic";
      return resp(r.status, { error: msg });
    }
    const text = (data && data.content && data.content[0] && data.content[0].text) || "";
    return resp(200, { text: text });
  } catch (e) {
    return resp(502, { error: "Fallo de red con Anthropic", detail: String(e) });
  }
};

function resp(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj)
  };
}
