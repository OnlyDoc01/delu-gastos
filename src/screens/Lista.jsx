import { useEffect, useMemo, useState } from 'react'
import { cargarGastos } from '../lib/data'
import { fechaLarga, pesos, rango, RANGOS, hoy } from '../lib/format'
import { Chips, Icono, Vacio } from '../ui'
import FilaGasto from './FilaGasto'

export default function Lista({ version, categorias, metodos, editar }) {
  const [clave, setClave] = useState('mes')
  const [custom, setCustom] = useState(rango('mes'))
  const [categoria, setCategoria] = useState('')
  const [metodo, setMetodo] = useState('')
  const [buscar, setBuscar] = useState('')
  const [gastos, setGastos] = useState(null)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState(false)

  const r = clave === 'custom' ? custom : rango(clave)

  useEffect(() => {
    let vivo = true
    setGastos(null)
    cargarGastos({ ...r, categoria, metodo })
      .then((d) => { if (vivo) { setGastos(d); setError('') } })
      .catch((e) => vivo && setError(e.message))
    return () => { vivo = false }
  }, [r.desde, r.hasta, categoria, metodo, version]) // eslint-disable-line

  const filtrados = useMemo(() => {
    if (!gastos) return null
    const t = buscar.trim().toLowerCase()
    if (!t) return gastos
    return gastos.filter((g) => `${g.proveedor || ''} ${g.descripcion || ''}`.toLowerCase().includes(t) || String(Math.round(g.monto)).includes(t))
  }, [gastos, buscar])

  const dias = useMemo(() => {
    const m = new Map()
    ;(filtrados || []).forEach((g) => { if (!m.has(g.fecha)) m.set(g.fecha, []); m.get(g.fecha).push(g) })
    return [...m.entries()]
  }, [filtrados])

  const total = (filtrados || []).reduce((s, g) => s + Number(g.monto), 0)
  const nFiltros = (categoria ? 1 : 0) + (metodo ? 1 : 0)

  return (
    <div className="pantalla">
      <header className="pantalla-cab">
        <h1>Gastos</h1>
      </header>

      <div className="buscador">
        <Icono n="buscar" tam={18} />
        <input type="search" placeholder="Buscar concepto, comercio o monto" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>

      <div className="rango-scroll">
        <Chips opciones={RANGOS.map(([id, nombre]) => ({ id, nombre }))} valor={clave} cambiar={setClave} />
      </div>
      {clave === 'custom' && (
        <div className="rango-custom">
          <label className="campo"><span>Desde</span><input type="date" value={custom.desde} max={custom.hasta} onChange={(e) => setCustom((c) => ({ ...c, desde: e.target.value }))} /></label>
          <label className="campo"><span>Hasta</span><input type="date" value={custom.hasta} min={custom.desde} max={hoy()} onChange={(e) => setCustom((c) => ({ ...c, hasta: e.target.value }))} /></label>
        </div>
      )}

      <button className="btn-filtros" onClick={() => setFiltros((v) => !v)} aria-expanded={filtros}>
        Filtrar por categoría o método {nFiltros > 0 && <span className="insignia">{nFiltros}</span>}
      </button>
      {filtros && (
        <div className="panel-filtros">
          <h3>Categoría</h3>
          <Chips opciones={categorias} valor={categoria} cambiar={setCategoria} todos="Todas" />
          <h3>Método de pago</h3>
          <Chips opciones={metodos} valor={metodo} cambiar={setMetodo} todos="Todos" />
        </div>
      )}

      <div className="total-filtro">
        <span>{filtrados ? `${filtrados.length} ${filtrados.length === 1 ? 'gasto' : 'gastos'}` : 'Cargando…'}</span>
        <strong>{pesos(total)}</strong>
      </div>

      {error && <p className="error">No se pudieron cargar los gastos: {error}</p>}
      {filtrados && filtrados.length === 0 && (
        <Vacio titulo="No hay gastos con estos filtros" texto="Cambia el periodo o quita filtros." />
      )}

      {dias.map(([fecha, lista]) => (
        <section key={fecha} className="dia">
          <h2 className="dia-cab">
            <span>{fechaLarga(fecha)}</span>
            <span>{pesos(lista.reduce((s, g) => s + Number(g.monto), 0))}</span>
          </h2>
          <ul className="lista-gastos">
            {lista.map((g) => <FilaGasto key={g.id} g={g} categorias={categorias} metodos={metodos} onClick={() => editar(g)} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}
