export async function askAssistant(query, { fetchImpl = globalThis.fetch, signal } = {}) {
  const response = await fetchImpl('/api/assistant/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query }),
    signal
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 401) {
    return { ok: false, code: 'AUTH_REQUIRED', claims: [], http_status: 401 };
  }

  if (response.status === 400) {
    return {
      ok: false,
      code: body?.code || 'ASSISTANT_QUERY_INVALID',
      claims: [],
      http_status: 400
    };
  }

  if (!response.ok || !body) {
    return { ok: false, code: 'ASSISTANT_HTTP_ERROR', claims: [], http_status: response.status };
  }

  return { ...body, http_status: response.status };
}
