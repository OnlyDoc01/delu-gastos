import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { cargarGastos } from '../lib/data'
import { exportarExcel } from '../lib/excel'
import { fechaCorta, hoy, pesos, rango, RANGOS } from '../lib/format'
import { Chips, Icono } from '../ui'

export default function Exportar({ categorias, metodos, esAdmin, notificar }) {
  const [clave, setClave] = useState('mes')
  const [custom, setCustom] = useState(rango('mes'))
  const [categoria, setCategoria] = useState('')
  const [metodo, setMetodo] = useState('')
  const [vista, setVista] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  const r = clave === 'custom' ? custom : rango(clave)

  useEffect(() => {
    let vivo = true
    setVista(null)
    cargarGastos({ ...r, categoria, metodo })
      .then((g) => vivo && setVista({ n: g.length, total: g.reduce((s, x) => s + Number(x.monto), 0), gastos: g }))
      .catch((e) => vivo && setError(e.message))
    return () => { vivo = false }
  }, [r.desde, r.hasta, categoria, metodo]) // eslint-disable-line

  async function descargar() {
    setTrabajando(true); setError('')
    try {
      let perfiles = []
      if (esAdmin) {
        const { data } = await supabase.from('perfiles').select('id, nombre, email')
        perfiles = data || []
      }
      await exportarExcel({ gastos: vista.gastos, categorias, metodos, perfiles, desde: r.desde, hasta: r.hasta })
      notificar('Excel listo')
    } catch (e) {
      setError('No se pudo crear el archivo: ' + e.message)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="pantalla">
      <header className="pantalla-cab">
        <h1>Descargar en Excel</h1>
        <p className="texto-suave">Elige el periodo y, si quieres, una categoría o un método de pago.</p>
      </header>

      <section className="grupo">
        <h3>Periodo</h3>
        <Chips opciones={RANGOS.map(([id, nombre]) => ({ id, nombre }))} valor={clave} cambiar={setClave} />
        {clave === 'custom' && (
          <div className="rango-custom">
            <label className="campo"><span>Desde</span><input type="date" value={custom.desde} max={custom.hasta} onChange={(e) => setCustom((c) => ({ ...c, desde: e.target.value }))} /></label>
            <label className="campo"><span>Hasta</span><input type="date" value={custom.hasta} min={custom.desde} max={hoy()} onChange={(e) => setCustom((c) => ({ ...c, hasta: e.target.value }))} /></label>
          </div>
        )}
      </section>

      <section className="grupo">
        <h3>Categoría</h3>
        <Chips opciones={categorias} valor={categoria} cambiar={setCategoria} todos="Todas" />
      </section>
      <section className="grupo">
        <h3>Método de pago</h3>
        <Chips opciones={metodos} valor={metodo} cambiar={setMetodo} todos="Todos" />
      </section>

      <div className="export-resumen">
        <p className="texto-suave">{fechaCorta(r.desde)} a {fechaCorta(r.hasta)}</p>
        <p className="export-total">{vista ? pesos(vista.total) : '—'}</p>
        <p className="texto-suave">{vista ? `${vista.n} ${vista.n === 1 ? 'gasto' : 'gastos'} en el archivo` : 'Calculando…'}</p>
        {error && <p className="error">{error}</p>}
        <button className="btn-principal ancho" onClick={descargar} disabled={!vista || vista.n === 0 || trabajando}>
          <Icono n="descargar" tam={20} /> {trabajando ? 'Creando archivo…' : 'Descargar Excel'}
        </button>
        <p className="nota">El archivo trae dos hojas: el detalle de cada gasto y un resumen por categoría y método de pago. En el iPhone puedes guardarlo en Archivos o enviarlo por WhatsApp.</p>
      </div>
    </div>
  )
}
