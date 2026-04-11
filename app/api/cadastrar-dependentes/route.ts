import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateCPF, cleanCPF } from '@/lib/cpf'

interface DependenteInput {
  nome: string
  email: string
  cpf: string
  telefone: string
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { cpfTitular, dependentes } = body as {
    cpfTitular: string
    dependentes: DependenteInput[]
  }

  if (!cpfTitular || !dependentes || !Array.isArray(dependentes)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const cpfTitularClean = cleanCPF(cpfTitular)

  // Verify titular exists and get full data for Clube Certo
  const { data: titular, error: titularError } = await supabaseAdmin
    .from('Compradores_Clube_Certo')
    .select('cpf_titular, nome_titular, email_titular, telefone_titular, oferta')
    .eq('cpf_titular', cpfTitularClean)
    .single()

  if (titularError || !titular) {
    return NextResponse.json({ error: 'Titular não encontrado' }, { status: 404 })
  }

  // Validate and clean dependentes
  const rows: DependenteInput[] = []
  for (const dep of dependentes) {
    if (!dep.nome?.trim() || !dep.cpf?.trim()) continue
    const cpfClean = cleanCPF(dep.cpf)
    if (!validateCPF(cpfClean)) {
      return NextResponse.json(
        { error: `CPF inválido para dependente: ${dep.nome}` },
        { status: 400 }
      )
    }
    rows.push({
      nome: dep.nome.trim(),
      email: dep.email?.trim() ?? '',
      cpf: cpfClean,
      telefone: dep.telefone?.replace(/\D/g, '') ?? '',
    })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Nenhum dependente válido informado' }, { status: 400 })
  }

  const { error: insertError } = await supabaseAdmin
    .from('dependentes')
    .insert(
      rows.map((r) => ({
        cpf_titular: cpfTitularClean,
        nome: r.nome,
        email: r.email,
        cpf: r.cpf,
        telefone: r.telefone,
      }))
    )

  if (insertError) {
    console.error('Erro ao salvar dependentes:', insertError)
    return NextResponse.json({ error: 'Erro ao salvar. Tente novamente.' }, { status: 500 })
  }

  // Disparar webhook n8n para registrar dependentes no Clube Certo
  try {
    await fetch('https://webhook.grupoflynow.site/webhook/dependentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpfTitular: cpfTitularClean,
        nomeTitular: titular.nome_titular,
        dependentes: rows.map((r) => ({
          nome: r.nome,
          cpf: r.cpf,
          email: r.email,
          telefone: r.telefone,
        })),
      }),
    })
  } catch (err) {
    console.error('Webhook n8n erro:', String(err))
  }

  return NextResponse.json({ success: true, count: rows.length })
}
