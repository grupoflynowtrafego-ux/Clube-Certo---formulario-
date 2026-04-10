import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateCPF, cleanCPF } from '@/lib/cpf'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const raw = body?.cpf ?? ''
  const cpf = cleanCPF(raw)

  if (!validateCPF(cpf)) {
    return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('Compradores_Clube_Certo')
    .select('cpf_titular, nome_titular, oferta')
    .eq('cpf_titular', cpf)
    .single()

  if (error || !data) {
    console.error('Supabase error:', JSON.stringify(error))
    return NextResponse.json({ found: false, debug: error?.message ?? 'no data' }, { status: 404 })
  }

  return NextResponse.json({
    found: true,
    nome: data.nome_titular,
    oferta: data.oferta ?? null,
  })
}
