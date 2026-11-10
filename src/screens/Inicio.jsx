import { useEffect, useMemo, useState } from 'react'
import { cargarGastos } from '../lib/data'
import { hoy, iso, nombreMes, parseISO, pesos, cap } from '../lib/format'
import { Vacio } from '../ui'
import FilaGasto from './FilaGasto'

export default function Inicio({ version, categorias, metodos, editar, irA, perfil }) {
  const h = parseISO(hoy())
  const [mes, setMes] = useState({ y: h.getFullYear(), m: h.getMonth() })
  const [actual, setActual] = useState(null)
  const [previo, setPrevio] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    const desde = iso(new Date(mes.y, mes.m, 1)), hasta = iso(new Date(mes.y, mes.m + 1, 0))
    const pd = iso(new Date(mes.y, mes.m - 1, 1)), ph = iso(new Date(mes.y, mes.m, 0))
    setActual(null)
    Promise.all([cargarGastos({ desde, hasta }), cargarGastos({ desde: pd, hasta: ph })])
      .then(([a, p]) => { if (vivo) { setActual(a); setPrevio(p); setError('') } })
      .catch((e) => vivo && setError(e.message))
    return () => { vivo = false }
  }, [mes, version])

  const esMesActual = mes.y === h.getFullYear() && mes.m === h.getMonth()
  const total = (l) => (l || []).reduce((s, g) => s + Number(g.monto), 0)
  const tA = total(actual), tP = total(previo)

  // Para comparar justo: en el mes en curso, se compara contra el mismo número de días del mes anterior
  const tPComparable = useMemo(() => {
    if (!previo) return 0
    if (!esMesActual) return tP
    const dia = h.getDate()
    return previo.filter((g) => parseISO(g.fecha).getDate() <= dia).reduce((s, g) => s + Number(g.monto), 0)
  }, [previo, esMesActual]) // eslint-disable-line

  const porCat = useMemo(() => {
    const m = {}
    ;(actual || []).forEach((g) => { m[g.categoria_id || 'x'] = (m[g.categoria_id || 'x'] || 0) + Number(g.monto) })
    return Object.entries(m).map(([id, v]) => {
      const c = categorias.find((c) => c.id === id)
      return { id, v, nombre: c?.nombre || 'Sin categoría', color: c?.color || '#999', icono: c?.icono || '•' }
    }).sort((a, b) => b.v - a.v)
  }, [actual, categorias])

  const variacion = tPComparable ? (tA - tPComparable) / tPComparable : null
  const mover = (d) => setMes(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() } })

  return (
    <div className="pantalla">
      <header className="saludo">
        <span className="marca">delú</span>
        <span className="texto-suave">Hola, {perfil.nombre?.split(' ')[0]}</span>
      </header>

      <section className="hero-mes">
        <div className="mes-nav">
          <button className="btn-icono" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
          <span>{cap(nombreMes(mes.m))} {mes.y !== h.getFullYear() ? mes.y : ''}</span>
          <button className="btn-icono" onClick={() => mover(1)} disabled={esMesActual} aria-label="Mes siguiente">›</button>
        </div>
        <p className="hero-total" aria-live="polite">{actual ? pesos(tA) : '—'}</p>
        <p className="hero-sub">
          {actual && `${actual.length} ${actual.length === 1 ? 'gasto' : 'gastos'}`}
          {variacion !== null && actual && (
            <span className={'variacion ' + (variacion > 0 ? 'sube' : 'baja')}>
              {variacion > 0 ? '▲' : '▼'} {Math.abs(variacion * 100).toFixed(0)}% vs. {esMesActual ? 'mismo corte del' : ''} mes anterior
            </span>
          )}
        </p>
      </section>

      {error && <p className="error">No se pudieron cargar los gastos: {error}</p>}

      {actual && actual.length === 0 && (
        <Vacio titulo="Sin gastos este mes" texto="Registra el primero con el botón + de abajo." />
      )}

      {porCat.length > 0 && (
        <section className="bloque">
          <h2 className="bloque-t">En qué se fue</h2>
          <ul className="barras-cat">
            {porCat.map((c) => (
              <li key={c.id}>
                <div className="bc-fila">
                  <span className="bc-nombre"><span aria-hidden="true">{c.icono}</span> {c.nombre}</span>
                  <span className="bc-valor">{pesos(c.v)}</span>
                </div>
                <div className="bc-pista"><div className="bc-barra" style={{ width: `${(c.v / porCat[0].v) * 100}%`, background: c.color }} /></div>
                <span className="bc-pct">{((c.v / tA) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {actual && actual.length > 0 && (
        <section className="bloque">
          <div className="bloque-cab">
            <h2 className="bloque-t">Últimos registros</h2>
            <button className="btn-texto" onClick={() => irA('lista')}>Ver todos</button>
          </div>
          <ul className="lista-gastos">
            {actual.slice(0, 6).map((g) => (
              <FilaGasto key={g.id} g={g} categorias={categorias} metodos={metodos} onClick={() => editar(g)} conFecha />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
