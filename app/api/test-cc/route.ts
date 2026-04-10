import { NextResponse } from 'next/server'
import { getToken } from '@/lib/clubecerto'

export async function GET() {
  const cnpj = process.env.CLUBE_CERTO_CNPJ
  const password = process.env.CLUBE_CERTO_PASSWORD

  const result: Record<string, unknown> = {
    env: {
      cnpj: !!cnpj,
      cnpj_value: cnpj ? `${cnpj.slice(0, 6)}...` : null,
      password: !!password,
    },
    login: null,
  }

  try {
    const token = await getToken()
    result.login = { ok: true }
    result.token_preview = token.slice(0, 30) + '...'
  } catch (err) {
    result.login = { ok: false, error: String(err) }
  }

  return NextResponse.json(result)
}
