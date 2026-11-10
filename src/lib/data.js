import { supabase } from '../supabase'

const SELECT = 'id, fecha, monto, proveedor, descripcion, factura_path, creado_por, creado_en, categoria_id, metodo_pago_id'

// Trae todos los gastos de un rango, paginando de 1000 en 1000
export async function cargarGastos({ desde, hasta, categoria, metodo } = {}) {
  const todos = []
  const paso = 1000
  for (let i = 0; ; i += paso) {
    let q = supabase.from('gastos').select(SELECT)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false })
      .range(i, i + paso - 1)
    if (desde) q = q.gte('fecha', desde)
    if (hasta) q = q.lte('fecha', hasta)
    if (categoria) q = q.eq('categoria_id', categoria)
    if (metodo) q = q.eq('metodo_pago_id', metodo)
    const { data, error } = await q
    if (error) throw error
    todos.push(...data)
    if (data.length < paso) break
  }
  return todos
}

export async function cargarCatalogos() {
  const [c, m] = await Promise.all([
    supabase.from('categorias').select('*').order('orden').order('nombre'),
    supabase.from('metodos_pago').select('*').order('orden').order('nombre'),
  ])
  if (c.error) throw c.error
  if (m.error) throw m.error
  return { categorias: c.data, metodos: m.data }
}

export async function guardarGasto(gasto, archivo, userId) {
  let factura_path = gasto.factura_path || null
  if (archivo) {
    const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase()
    const ruta = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('facturas').upload(ruta, archivo, { contentType: archivo.type })
    if (error) throw error
    if (factura_path) await supabase.storage.from('facturas').remove([factura_path])
    factura_path = ruta
  }
  const fila = {
    fecha: gasto.fecha,
    monto: gasto.monto,
    categoria_id: gasto.categoria_id || null,
    metodo_pago_id: gasto.metodo_pago_id || null,
    proveedor: gasto.proveedor?.trim() || null,
    descripcion: gasto.descripcion?.trim() || null,
    factura_path,
  }
  const res = gasto.id
    ? await supabase.from('gastos').update(fila).eq('id', gasto.id).select(SELECT).single()
    : await supabase.from('gastos').insert(fila).select(SELECT).single()
  if (res.error) throw res.error
  return res.data
}

export async function borrarGasto(g) {
  const { error } = await supabase.from('gastos').delete().eq('id', g.id)
  if (error) throw error
  if (g.factura_path) await supabase.storage.from('facturas').remove([g.factura_path])
}

export async function urlFactura(path) {
  const { data, error } = await supabase.storage.from('facturas').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

// Reduce una foto a máx. 1600px para que suba rápido
export async function comprimirImagen(file) {
  if (!file.type.startsWith('image/')) return file
  try {
    const bmp = await createImageBitmap(file)
    const max = 1600
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82))
    return blob ? new File([blob], 'factura.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}
