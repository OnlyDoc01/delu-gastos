import { fechaCorta } from './format'

// Genera un .xlsx con dos hojas: Gastos (detalle) y Resumen (por categoría y método)
export async function exportarExcel({ gastos, categorias, metodos, perfiles, desde, hasta }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Delú Gastos'
  wb.created = new Date()

  const cat = Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))
  const met = Object.fromEntries(metodos.map((m) => [m.id, m.nombre]))
  const per = Object.fromEntries((perfiles || []).map((p) => [p.id, p.nombre || p.email]))
  const verde = 'FF1E3A2F'
  const fmtPesos = '"$"#,##0;[Red]-"$"#,##0'

  // Hoja 1: detalle
  const ws = wb.addWorksheet('Gastos', { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.columns = [
    { key: 'fecha', width: 13 },
    { key: 'categoria', width: 22 },
    { key: 'proveedor', width: 24 },
    { key: 'descripcion', width: 36 },
    { key: 'metodo', width: 17 },
    { key: 'monto', width: 15 },
    { key: 'registro', width: 18 },
    { key: 'factura', width: 9 },
  ]
  ws.mergeCells('A1:H1')
  ws.getCell('A1').value = `Gastos Delú · ${fechaCorta(desde)} a ${fechaCorta(hasta)}`
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: verde } }
  ws.getRow(1).height = 22
  const enc = ws.getRow(3)
  enc.values = ['Fecha', 'Categoría', 'Proveedor', 'Descripción', 'Método de pago', 'Monto', 'Registrado por', 'Factura']
  enc.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: verde } }
    c.alignment = { vertical: 'middle' }
  })
  enc.height = 20

  const orden = [...gastos].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
  orden.forEach((g) => {
    const r = ws.addRow({
      fecha: new Date(Date.UTC(...g.fecha.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)))),
      categoria: cat[g.categoria_id] || 'Sin categoría',
      proveedor: g.proveedor || '',
      descripcion: g.descripcion || '',
      metodo: met[g.metodo_pago_id] || '',
      monto: Number(g.monto),
      registro: per[g.creado_por] || '',
      factura: g.factura_path ? 'Sí' : '',
    })
    r.getCell('fecha').numFmt = 'dd/mm/yyyy'
    r.getCell('monto').numFmt = fmtPesos
  })
  const primera = 4, ultima = 3 + orden.length
  const tot = ws.addRow({ descripcion: 'Total', monto: orden.length ? { formula: `SUM(F${primera}:F${ultima})` } : 0 })
  tot.font = { bold: true }
  tot.getCell('monto').numFmt = fmtPesos
  tot.getCell('descripcion').alignment = { horizontal: 'right' }
  if (orden.length) ws.autoFilter = { from: 'A3', to: `H${ultima}` }

  // Hoja 2: resumen
  const rs = wb.addWorksheet('Resumen')
  rs.columns = [{ width: 26 }, { width: 16 }, { width: 12 }, { width: 10 }]
  rs.getCell('A1').value = `Resumen ${fechaCorta(desde)} a ${fechaCorta(hasta)}`
  rs.getCell('A1').font = { bold: true, size: 14, color: { argb: verde } }

  const bloque = (fila, titulo, mapa, nombres) => {
    const h = rs.getRow(fila)
    h.values = [titulo, 'Total', 'Cantidad', '%']
    h.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: verde } }
    })
    const total = orden.reduce((s, g) => s + Number(g.monto), 0)
    const grupos = {}
    orden.forEach((g) => {
      const k = nombres[mapa(g)] || 'Sin asignar'
      grupos[k] ??= { total: 0, n: 0 }
      grupos[k].total += Number(g.monto); grupos[k].n++
    })
    let f = fila + 1
    Object.entries(grupos).sort((a, b) => b[1].total - a[1].total).forEach(([k, v]) => {
      const r = rs.getRow(f++)
      r.values = [k, v.total, v.n, total ? v.total / total : 0]
      r.getCell(2).numFmt = fmtPesos
      r.getCell(4).numFmt = '0.0%'
    })
    const r = rs.getRow(f++)
    r.values = ['Total', total, orden.length, total ? 1 : 0]
    r.font = { bold: true }
    r.getCell(2).numFmt = fmtPesos
    r.getCell(4).numFmt = '0.0%'
    return f + 1
  }
  let f = bloque(3, 'Categoría', (g) => g.categoria_id, cat)
  bloque(f, 'Método de pago', (g) => g.metodo_pago_id, met)

  const buf = await wb.xlsx.writeBuffer()
  const nombre = `gastos-delu_${desde}_a_${hasta}.xlsx`
  const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const archivo = new File([buf], nombre, { type: tipo })

  // En iPhone la hoja de compartir permite guardar en Archivos, enviar por WhatsApp o correo
  if (navigator.canShare && navigator.canShare({ files: [archivo] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [archivo], title: nombre })
      return
    } catch (e) {
      if (e.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(archivo)
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
