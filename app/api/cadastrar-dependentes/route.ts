import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateCPF, cleanCPF } from '@/lib/cpf'
import { getToken, registerAssociate } from '@/lib/clubecerto'

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

  // Register dependents in Clube Certo
  const ccResults: { dep: string; ok: boolean; error?: string }[] = []
  try {
    const token = await getToken()
    let titularRegistered = false

    for (const dep of rows) {
      const result = await registerAssociate(token, {
        name: dep.nome,
        cpf: dep.cpf,
        ...(dep.email ? { email: dep.email } : {}),
        ...(dep.telefone ? { phone: dep.telefone } : {}),
        fatherCPF: cpfTitularClean,
      })

      if (!result.ok && result.error?.includes('fatherNotFounded') && !titularRegistered) {
        const titularResult = await registerAssociate(token, {
          name: titular.nome_titular,
          cpf: cpfTitularClean,
          ...(titular.email_titular ? { email: titular.email_titular } : {}),
          ...(titular.telefone_titular ? { phone: titular.telefone_titular.replace(/\D/g, '') } : {}),
        })
        titularRegistered = true
        if (!titularResult.ok) {
          ccResults.push({ dep: 'titular', ok: false, error: titularResult.error })
        } else {
          const retry = await registerAssociate(token, {
            name: dep.nome,
            cpf: dep.cpf,
            ...(dep.email ? { email: dep.email } : {}),
            ...(dep.telefone ? { phone: dep.telefone } : {}),
            fatherCPF: cpfTitularClean,
          })
          ccResults.push({ dep: dep.nome, ok: retry.ok, error: retry.error })
        }
      } else {
        ccResults.push({ dep: dep.nome, ok: result.ok, error: result.error })
      }
    }
  } catch (err) {
    ccResults.push({ dep: 'getToken', ok: false, error: String(err) })
  }

  return NextResponse.json({ success: true, count: rows.length, cc: ccResults })
}
