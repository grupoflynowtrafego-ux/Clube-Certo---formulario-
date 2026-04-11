const BASE = 'https://node.clubecerto.com.br/superapp'

export async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/companyAPI/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cnpj: process.env.CLUBE_CERTO_CNPJ,
      password: process.env.CLUBE_CERTO_PASSWORD,
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.token) {
    throw new Error(`Clube Certo login failed: ${JSON.stringify(data)}`)
  }
  // API returns token with or without "Bearer " prefix — normalize to raw token
  return (data.token as string).replace(/^Bearer\s+/i, '')
}

export async function registerAssociate(
  token: string,
  data: { name: string; cpf: string; email?: string; phone?: string; fatherCPF?: string }
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/companyAPI/associate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: data.name,
      cpf: data.cpf,
      email: data.email ?? '',
      phone: data.phone ?? '',
      ...(data.fatherCPF ? { fatherCPF: data.fatherCPF } : {}),
    }),
  })
  const json = await res.json()
  if (res.ok) return { ok: true }
  return { ok: false, error: json?.message ?? json?.error ?? JSON.stringify(json) }
}
