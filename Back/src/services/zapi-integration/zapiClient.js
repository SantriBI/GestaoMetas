function texto(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function getZapiConfig() {
  return {
    instanceId: texto(process.env.ZAPI_INSTANCE_ID),
    instanceToken: texto(process.env.ZAPI_INSTANCE_TOKEN),
    clientToken: texto(process.env.ZAPI_CLIENT_TOKEN),
    baseUrl: (texto(process.env.ZAPI_BASE_URL) ?? "https://api.z-api.io").replace(/\/$/, ""),
  }
}

export function isZapiConfigured() {
  const config = getZapiConfig()
  return Boolean(config.instanceId && config.instanceToken && config.clientToken)
}

export function assertZapiConfigured() {
  if (isZapiConfigured()) {
    return getZapiConfig()
  }

  throw new Error(
    "Configuracao Z-API incompleta. Preencha ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN e, se necessario, ZAPI_BASE_URL."
  )
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null)
  }

  const raw = await response.text().catch(() => "")
  return raw ? { raw } : null
}

async function zapiRequest(path, { method = "POST", body } = {}) {
  const config = assertZapiConfigured()
  const response = await fetch(
    `${config.baseUrl}/instances/${config.instanceId}/token/${config.instanceToken}/${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        "Client-Token": config.clientToken,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  )

  const payload = await parseResponsePayload(response)
  if (!response.ok) {
    throw new Error(
      `Falha na Z-API (${response.status}). ${payload?.error ?? payload?.message ?? payload?.raw ?? "Sem detalhe retornado."}`
    )
  }

  return payload
}

export async function sendTextMessage({ phone, message }) {
  return zapiRequest("send-text", {
    method: "POST",
    body: {
      phone,
      message,
    },
  })
}

export async function updateDeliveryWebhook(url) {
  return zapiRequest("update-webhook-delivery", {
    method: "PUT",
    body: { value: url },
  })
}

export async function updateStatusWebhook(url) {
  return zapiRequest("update-webhook-message-status", {
    method: "PUT",
    body: { value: url },
  })
}

export async function updateReceiveWebhook(url) {
  return zapiRequest("update-webhook-received", {
    method: "PUT",
    body: { value: url },
  })
}

export async function updateNotifySentByMe(notifySentByMe = true) {
  return zapiRequest("update-notify-sent-by-me", {
    method: "PUT",
    body: { notifySentByMe },
  })
}

export async function configureDefaultWebhooks(publicBaseUrl) {
  const base = texto(publicBaseUrl)?.replace(/\/$/, "")
  if (!base) {
    throw new Error("SIP_PUBLIC_URL e obrigatoria para configurar os webhooks da Z-API.")
  }

  const webhookUrl = `${base}/api/webhooks/zapi`
  const [delivery, status, receive, notifySentByMe] = await Promise.all([
    updateDeliveryWebhook(webhookUrl),
    updateStatusWebhook(webhookUrl),
    updateReceiveWebhook(webhookUrl),
    updateNotifySentByMe(true),
  ])

  return {
    webhook_url: webhookUrl,
    delivery,
    status,
    receive,
    notify_sent_by_me: notifySentByMe,
  }
}
