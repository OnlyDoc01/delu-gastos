import { useEffect, useRef, useState } from 'react'
import { guardarGasto, borrarGasto, comprimirImagen, urlFactura } from '../lib/data'
import { hoy, numero } from '../lib/format'
import { Chips, Icono } from '../ui'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'borrar']

export default function Registro({ gasto, cerrar, alGuardar, categorias, metodos, userId, esAdmin }) {
  const nuevo = !gasto.id
  const [monto, setMonto] = useState(gasto.monto ? String(Math.round(gasto.monto)) : '')
  const [f, setF] = useState({
    fecha: gasto.fecha || hoy(),
    categoria_id: gasto.categoria_id || '',
    metodo_pago_id: gasto.metodo_pago_id || (nuevo ? localStorageGet('ultimoMetodo') : '') || '',
    proveedor: gasto.proveedor || '',
    descripcion: gasto.descripcion || '',
  })
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [paso, setPaso] = useState(nuevo ? 'monto' : 'detalle')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const inputFoto = useRef()

  const activas = categorias.filter((c) => c.activa || c.id === gasto.categoria_id)
  const metodosAct = metodos.filter((m) => m.activo || m.id === gasto.metodo_pago_id)
  const puedeEditar = nuevo || esAdmin || gasto.creado_por === userId

  useEffect(() => {
    if (archivo) {
      const u = URL.createObjectURL(archivo); setPreview(u)
      return () => URL.revokeObjectURL(u)
    }
    if (gasto.factura_path) urlFactura(gasto.factura_path).then(setPreview).catch(() => {})
  }, [archivo, gasto.factura_path])

  useEffect(() => {
    const t = (e) => {
      if (paso !== 'monto') return
      if (/^[0-9]$/.test(e.key)) tecla(e.key)
      else if (e.key === 'Backspace') tecla('borrar')
      else if (e.key === 'Enter' && Number(monto) > 0) setPaso('detalle')
      else if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  })

  function tecla(k) {
    setMonto((m) => {
      if (k === 'borrar') return m.slice(0, -1)
      const n = (m + k).replace(/^0+/, '')
      return n.length > 12 ? m : n
    })
  }

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: typeof v === 'object' && v?.target ? v.target.value : v }))

  async function guardar() {
    setError('')
    if (!(Number(monto) > 0)) { setPaso('monto'); return }
    if (!f.categoria_id) { setError('Elige una categoría.'); return }
    setGuardando(true)
    try {
      await guardarGasto({ ...gasto, ...f, monto: Number(monto) }, archivo, userId)
      if (f.metodo_pago_id) localStorageSet('ultimoMetodo', f.metodo_pago_id)
      alGuardar(gasto.por_revisar ? 'Gasto confirmado' : nuevo ? 'Gasto registrado' : 'Cambios guardados')
    } catch (e) {
      setError('No se pudo guardar: ' + e.message + '. Revisa tu conexión e inténtalo otra vez.')
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!confirm('¿Eliminar este gasto? No se puede deshacer.')) return
    setGuardando(true)
    try { await borrarGasto(gasto); alGuardar('Gasto eliminado') } catch (e) { setError(e.message); setGuardando(false) }
  }

  async function elegirFoto(e) {
    const file = e.target.files?.[0]
    if (file) setArchivo(await comprimirImagen(file))
  }

  return (
    <div className="registro" role="dialog" aria-modal="true" aria-label={nuevo ? 'Registrar gasto' : 'Editar gasto'}>
      <header className="registro-cab">
        {paso === 'detalle' && nuevo
          ? <button className="btn-icono" onClick={() => setPaso('monto')} aria-label="Cambiar monto"><Icono n="atras" /></button>
          : <span />}
        <h2>{nuevo ? 'Nuevo gasto' : 'Editar gasto'}</h2>
        <button className="btn-icono" onClick={cerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
      </header>

      <button className={'monto-visor' + (paso === 'detalle' ? ' compacto' : '')} onClick={() => puedeEditar && setPaso('monto')} disabled={!puedeEditar} aria-label="Monto">
        <span className="monto-signo">$</span>
        <span className={'monto-cifra' + (monto ? '' : ' vacio')}>{monto ? numero(monto) : '0'}</span>
      </button>

      {paso === 'monto' ? (
        <div className="registro-monto">
          <div className="teclado">
            {TECLAS.map((k) => (
              <button key={k} className="tecla" onClick={() => tecla(k)} aria-label={k === 'borrar' ? 'Borrar' : k}>
                {k === 'borrar' ? <Icono n="retroceso" tam={26} /> : k}
              </button>
            ))}
          </div>
          <button className="btn-principal ancho" disabled={!(Number(monto) > 0)} onClick={() => setPaso('detalle')}>Continuar</button>
        </div>
      ) : (
        <>
          <div className="registro-detalle">
            {gasto.por_revisar && (
              <p className="aviso-revisar-form">Leído automáticamente del comprobante. Revisa el monto, la categoría y el concepto, y toca “Confirmar gasto”.</p>
            )}
            <label className="campo"><span>Concepto</span>
              <input value={f.descripcion} onChange={set('descripcion')} placeholder="Ej. Pago de arriendo del local" autoComplete="off" />
            </label>
            <section className="grupo">
              <h3>Categoría</h3>
              <Chips opciones={activas} valor={f.categoria_id} cambiar={set('categoria_id')} />
            </section>
            <section className="grupo">
              <h3>Método de pago (opcional)</h3>
              <Chips opciones={metodosAct} valor={f.metodo_pago_id} cambiar={set('metodo_pago_id')} />
            </section>
            <section className="grupo campos">
              <label className="campo"><span>Fecha</span>
                <input type="date" value={f.fecha} max={hoy()} onChange={set('fecha')} required />
              </label>
              <label className="campo"><span>Comercio (opcional)</span>
                <input value={f.proveedor} onChange={set('proveedor')} placeholder="Ej. Effisystems S.A.S" autoComplete="off" />
              </label>
            </section>
            <section className="grupo">
              <h3>Foto del comprobante</h3>
              <input ref={inputFoto} type="file" accept="image/*,application/pdf" hidden onChange={elegirFoto} />
              {preview ? (
                <div className="factura">
                  {(archivo?.type || '').includes('pdf') || (!archivo && /\.pdf$/i.test(gasto.factura_path || ''))
                    ? <a className="factura-pdf" href={preview} target="_blank" rel="noreferrer">PDF adjunto, toca para abrirlo</a>
                    : <a href={preview} target="_blank" rel="noreferrer"><img src={preview} alt="Foto del comprobante" /></a>}
                  <button className="btn-secundario" onClick={() => inputFoto.current.click()}>Cambiar foto</button>
                </div>
              ) : (
                <button className="btn-foto" onClick={() => inputFoto.current.click()}>
                  <Icono n="camara" /> Tomar o subir foto
                </button>
              )}
            </section>
            {!nuevo && puedeEditar && (
              <button className="btn-peligro" onClick={eliminar} disabled={guardando}><Icono n="borrar" tam={18} /> Eliminar gasto</button>
            )}
          </div>
          <footer className="registro-pie">
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn-principal ancho" onClick={guardar} disabled={guardando || !puedeEditar}>
              {guardando ? 'Guardando…' : gasto.por_revisar ? 'Confirmar gasto' : nuevo ? 'Registrar gasto' : 'Guardar cambios'}
            </button>
          </footer>
        </>
      )}
    </div>
  )
}

function localStorageGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }
