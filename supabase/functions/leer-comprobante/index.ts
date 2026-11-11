// Lee un comprobante (imagen o PDF) con Claude y lo guarda como gasto "por revisar".
// Lo llama el Atajo de iPhone con la llave personal que se crea en la app (Ajustes).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { construirHerramienta, construirSistema, detectarTipo, EXTENSION, fechaBogota, pesos, validarLectura } from './logica.ts'

const MODELO = Deno.env.get('MODELO_LECTURA') ?? 'claude-haiku-5-5'
const MAX_BYTES = 4_500_000
const LIMITE_POR_HORA = 40

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const responder = (cuerpo: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
const falla = (mensaje: string, status: number) => responder({ ok: false, mensaje }, status)

async function sha256(texto: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function desdeBase64(s: string): Uint8Array {
  const limpio = s.replace(/^data:[^,]*,/, '').replace(/\s/g, '')
  const bin = atob(limpio)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function leerArchivo(req: Request): Promise<Uint8Array | null> {
  const tipo = req.headers.get('content-type') ?? ''
  if (tipo.includes('multipart/form-data')) {
    const form = await req.formData()
    let entrada: FormDataEntryValue | null = form.get('imagen')
    if (!entrada) for (const [, v] of form.entries()) { entrada = v; break }
    if (!entrada) return null
    if (typeof entrada === 'string') return desdeBase64(entrada)
    return new Uint8Array(await entrada.arrayBuffer())
  }
  if (tipo.includes('application/json')) {
    const j = await req.json()
    return typeof j?.imagen_base64 === 'string' ? desdeBase64(j.imagen_base64) : null
  }
  const buf = new Uint8Array(await req.arrayBuffer())
  return buf.length ? buf : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return falla('Usa el método POST.', 405)

  try {
    // 1. Quién llama: la llave personal del atajo
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return falla('Falta la llave del atajo. Créala en la app: Ajustes, Atajo para comprobantes.', 401)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const { data: llave } = await db.from('atajo_tokens').select('id, user_id').eq('token_hash', await sha256(token)).maybeSingle()
    if (!llave) return falla('La llave del atajo no es válida. Crea una nueva en la app: Ajustes, Atajo para comprobantes.', 401)
    const uid: string = llave.user_id

    const { data: perfil } = await db.from('perfiles').select('rol').eq('id', uid).maybeSingle()
    if (!perfil || !['admin', 'registrador'].includes(perfil.rol)) return falla('Tu cuenta aún no tiene acceso. Pídele al administrador que la apruebe.', 403)

    // 2. Límite de lecturas por hora (protege el saldo de la API)
    const desde = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await db.from('atajo_uso').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('creado_en', desde)
    if ((count ?? 0) >= LIMITE_POR_HORA) return falla('Hiciste muchas lecturas seguidas. Espera un rato e inténtalo de nuevo.', 429)
    await db.from('atajo_uso').insert({ user_id: uid })
    await db.from('atajo_tokens').update({ ultimo_uso: new Date().toISOString() }).eq('id', llave.id)

    // 3. El archivo
    const bytes = await leerArchivo(req)
    if (!bytes || bytes.length === 0) return falla('No llegó ninguna imagen. Revisa que el atajo envíe el campo "imagen".', 400)
    if (bytes.length > MAX_BYTES) return falla('La imagen pesa demasiado. En el atajo reduce el tamaño a 1600 píxeles de ancho.', 413)
    const tipo = detectarTipo(bytes)
    if (!tipo) return falla('Formato no compatible. En el atajo convierte la imagen a JPEG antes de enviarla.', 415)

    // 4. Contexto: categorías, métodos y ejemplos de gastos anteriores
    const [cats, mets, hist] = await Promise.all([
      db.from('categorias').select('id, nombre').eq('activa', true),
      db.from('metodos_pago').select('id, nombre').eq('activo', true),
      db.from('gastos').select('descripcion, proveedor, categoria_id').not('categoria_id', 'is', null).order('creado_en', { ascending: false }).limit(40),
    ])
    const categorias = cats.data ?? []
    const metodos = mets.data ?? []
    const nombreCat = new Map((await db.from('categorias').select('id, nombre')).data?.map((c) => [c.id, c.nombre]) ?? [])
    const ejemplos = (hist.data ?? [])
      .filter((g) => g.descripcion)
      .map((g) => ({ concepto: g.descripcion as string, comercio: (g.proveedor as string) ?? '', categoria: nombreCat.get(g.categoria_id) ?? 'Otros' }))

    // 5. Lectura con Claude
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return falla('Falta configurar la llave de Anthropic en Supabase (ANTHROPIC_API_KEY).', 500)
    const hoy = fechaBogota()
    const datos = encodeBase64(bytes)
    const bloque = tipo === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: tipo, data: datos } }
      : { type: 'image', source: { type: 'base64', media_type: tipo, data: datos } }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 600,
        system: construirSistema(hoy, ejemplos),
        tools: [construirHerramienta(categorias.map((c) => c.nombre), metodos.map((m) => m.nombre))],
        tool_choice: { type: 'tool', name: 'registrar_gasto' },
        messages: [{ role: 'user', content: [bloque, { type: 'text', text: 'Lee este comprobante y registra el gasto.' }] }],
      }),
    })
    if (!r.ok) {
      const detalle = (await r.text()).slice(0, 400)
      console.error('Anthropic', r.status, detalle)
      if (r.status === 401) return falla('La llave de Anthropic guardada en Supabase no es válida.', 502)
      if (/credit balance/i.test(detalle)) return falla('La cuenta de Anthropic no tiene saldo. Recárgala en console.anthropic.com.', 502)
      return falla('No pude leer el comprobante en este momento. Inténtalo de nuevo en un minuto.', 502)
    }
    const respuesta = await r.json()
    const uso = (respuesta.content ?? []).find((b: { type: string }) => b.type === 'tool_use')
    const lectura = validarLectura(uso?.input, { categorias: categorias.map((c) => c.nombre), metodos: metodos.map((m) => m.nombre), hoy })
    if (!lectura.ok) return falla(lectura.motivo, 422)
    const g = lectura.gasto

    // 6. Evitar duplicados si se comparte dos veces el mismo comprobante
    const hace10 = new Date(Date.now() - 600_000).toISOString()
    const { data: repetido } = await db.from('gastos').select('id').eq('creado_por', uid).eq('monto', g.monto).eq('fecha', g.fecha).gte('creado_en', hace10).limit(1)
    if (repetido?.length) return responder({ ok: true, duplicado: true, mensaje: `Ya estaba registrado: ${pesos(g.monto)} · ${g.concepto}.` })

    // 7. Guardar la foto del comprobante y el gasto
    const ruta = `${uid}/${crypto.randomUUID()}.${EXTENSION[tipo]}`
    const subida = await db.storage.from('facturas').upload(ruta, bytes, { contentType: tipo })
    if (subida.error) console.error('Storage', subida.error.message)

    const { data: nuevo, error } = await db.from('gastos').insert({
      fecha: g.fecha,
      monto: g.monto,
      categoria_id: categorias.find((c) => c.nombre === g.categoria)?.id ?? null,
      metodo_pago_id: metodos.find((m) => m.nombre === g.metodo)?.id ?? null,
      proveedor: g.comercio,
      descripcion: g.concepto,
      factura_path: subida.error ? null : ruta,
      creado_por: uid,
      por_revisar: true,
      origen: 'atajo',
    }).select('id').single()
    if (error) {
      console.error('Insert', error.message)
      if (!subida.error) await db.storage.from('facturas').remove([ruta])
      return falla('No pude guardar el gasto. Inténtalo de nuevo.', 500)
    }

    return responder({
      ok: true,
      id: nuevo.id,
      mensaje: `Registrado: ${pesos(g.monto)} · ${g.categoria ?? 'Sin categoría'} · ${g.concepto}. Revísalo en la app.`,
      gasto: g,
    })
  } catch (e) {
    console.error('Error', e instanceof Error ? e.message : e)
    return falla('Algo salió mal al leer el comprobante. Inténtalo de nuevo.', 500)
  }
})
