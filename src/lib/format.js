const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export const pesos = (v) => cop.format(Number(v || 0)).replace(/\s/g, ' ')
export const numero = (v) => num.format(Number(v || 0))

// Fecha local de Bogotá en formato YYYY-MM-DD
export function hoy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function iso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const nombreMes = (i) => MESES[i]

export function fechaLarga(s) {
  const d = parseISO(s)
  const h = hoy()
  if (s === h) return 'Hoy'
  const ayer = new Date(parseISO(h)); ayer.setDate(ayer.getDate() - 1)
  if (s === iso(ayer)) return 'Ayer'
  const base = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
  return d.getFullYear() === parseISO(h).getFullYear() ? cap(base) : cap(`${base} de ${d.getFullYear()}`)
}

export function fechaCorta(s) {
  const d = parseISO(s)
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Rangos predefinidos
export function rango(clave) {
  const h = parseISO(hoy())
  const y = h.getFullYear(), m = h.getMonth()
  switch (clave) {
    case 'hoy': return { desde: iso(h), hasta: iso(h) }
    case 'semana': {
      const d = new Date(h); const dia = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - dia)
      return { desde: iso(d), hasta: iso(h) }
    }
    case 'mes': return { desde: iso(new Date(y, m, 1)), hasta: iso(new Date(y, m + 1, 0)) }
    case 'mes_pasado': return { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)) }
    case 'trimestre': return { desde: iso(new Date(y, m - 2, 1)), hasta: iso(new Date(y, m + 1, 0)) }
    case 'anio': return { desde: iso(new Date(y, 0, 1)), hasta: iso(new Date(y, 11, 31)) }
    default: return null
  }
}

export const RANGOS = [
  ['mes', 'Este mes'],
  ['mes_pasado', 'Mes pasado'],
  ['semana', 'Esta semana'],
  ['hoy', 'Hoy'],
  ['trimestre', 'Últimos 3 meses'],
  ['anio', 'Este año'],
  ['custom', 'Personalizado'],
]
