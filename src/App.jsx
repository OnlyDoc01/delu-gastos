import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { cargarCatalogos, cargarGasto, comprimirImagen, contarPorRevisar, leerRecibo } from './lib/data'
import Login from './screens/Login'
import Inicio from './screens/Inicio'
import Lista from './screens/Lista'
import Registro from './screens/Registro'
import Exportar from './screens/Exportar'
import Ajustes from './screens/Ajustes'
import { Hoja, Icono } from './ui'
import { pesos } from './lib/format'

const TABS = [
  ['inicio', 'Resumen', 'inicio'],
  ['lista', 'Gastos', 'lista'],
  ['nuevo', 'Nuevo', 'mas'],
  ['exportar', 'Excel', 'excel'],
  ['ajustes', 'Ajustes', 'ajustes'],
]

export default function App() {
  const [sesion, setSesion] = useState(undefined)
  const [perfil, setPerfil] = useState(null)
  const [cat, setCat] = useState({ categorias: [], metodos: [] })
  const [tab, setTab] = useState(() => location.hash.replace('#', '') || 'inicio')
  const [editando, setEditando] = useState(null) // null | {} nuevo | gasto
  const [version, setVersion] = useState(0)
  const [aviso, setAviso] = useState(null)
  const [nRevisar, setNRevisar] = useState(0)
  const [revisarInicial, setRevisarInicial] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [lectura, setLectura] = useState(null) // { ok, gasto, mensaje, archivo }
  const inputCamara = useRef()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const cargarPerfil = useCallback(async () => {
    if (!sesion) { setPerfil(null); return }
    const { data } = await supabase.from('perfiles').select('*').eq('id', sesion.user.id).maybeSingle()
    setPerfil(data || { rol: 'pendiente' })
    if (data && data.rol !== 'pendiente') setCat(await cargarCatalogos())
  }, [sesion])

  useEffect(() => { cargarPerfil() }, [cargarPerfil])

  useEffect(() => {
    if (!sesion || !perfil || perfil.rol === 'pendiente') { setNRevisar(0); return }
    contarPorRevisar().then(setNRevisar).catch(() => {})
  }, [sesion, perfil, version])

  useEffect(() => { if (tab !== 'nuevo') history.replaceState(null, '', '#' + tab) }, [tab])

  const notificar = useCallback((texto) => {
    setAviso(texto)
    clearTimeout(window.__aviso)
    window.__aviso = setTimeout(() => setAviso(null), 2600)
  }, [])

  if (sesion === undefined) return <div className="cargando-app"><span className="marca">delú</span></div>
  if (!sesion) return <Login />
  if (!perfil) return <div className="cargando-app"><span className="marca">delú</span></div>
  if (perfil.rol === 'pendiente') return <Pendiente perfil={perfil} reintentar={cargarPerfil} />

  const tomarFoto = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setLeyendo(true)
    const img = await comprimirImagen(f, 2000)
    const r = await leerRecibo(img)
    setLeyendo(false)
    if (r.ok && r.duplicado) { notificar('Ya estaba registrado'); return }
    if (r.ok) setVersion((v) => v + 1)
    setLectura({ ...r, archivo: img })
  }
  const revisarLectura = async () => {
    const l = lectura
    setLectura(null)
    try { setEditando(await cargarGasto(l.id)) } catch { notificar('No pude abrir el gasto') }
  }
  const aMano = () => { const a = lectura.archivo; setLectura(null); setEditando({ __archivo: a }) }

  const ir = (id) => { setRevisarInicial(false); setTab(id) }
  const irARevisar = () => { setRevisarInicial(true); setTab('lista') }

  const ctx = {
    perfil, userId: sesion.user.id, esAdmin: perfil.rol === 'admin',
    ...cat, version, notificar, nRevisar, irARevisar,
    recargarCatalogos: async () => setCat(await cargarCatalogos()),
    editar: (g) => setEditando(g),
  }

  return (
    <div className="app">
      <main className="contenido">
        {tab === 'inicio' && <Inicio {...ctx} irA={ir} />}
        {tab === 'lista' && <Lista {...ctx} revisarInicial={revisarInicial} />}
        {tab === 'exportar' && <Exportar {...ctx} />}
        {tab === 'ajustes' && <Ajustes {...ctx} />}
      </main>

      {!editando && (tab === 'inicio' || tab === 'lista') && (
        <button className="fab-camara" onClick={() => inputCamara.current.click()} aria-label="Fotografiar un recibo" disabled={leyendo}>
          <Icono n="camara" />
        </button>
      )}
      <input ref={inputCamara} type="file" accept="image/*" capture="environment" hidden onChange={tomarFoto} />

      <nav className="barra" aria-label="Secciones">
        {TABS.map(([id, label, ic]) => id === 'nuevo' ? (
          <button key={id} className="barra-nuevo" onClick={() => setEditando({})} aria-label="Registrar gasto">
            <Icono n="mas" />
          </button>
        ) : (
          <button key={id} className={'barra-item' + (tab === id ? ' activo' : '')} onClick={() => ir(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icono n={ic} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {editando && (
        <Registro
          {...ctx}
          gasto={editando.__archivo ? {} : editando}
          archivoInicial={editando.__archivo}
          cerrar={() => setEditando(null)}
          alGuardar={(msg) => { setEditando(null); setVersion((v) => v + 1); notificar(msg) }}
        />
      )}
      {leyendo && (
        <div className="leyendo" role="status"><div className="leyendo-caja"><span className="spinner" /><b>Leyendo el recibo…</b><small>Tarda unos segundos</small></div></div>
      )}
      {lectura && lectura.ok && (
        <Hoja titulo="Recibo registrado" cerrar={() => setLectura(null)}
          pie={<div className="acciones-fila"><button className="btn-secundario" onClick={() => setLectura(null)}>Listo</button><button className="btn-principal" onClick={revisarLectura}>Revisar y editar</button></div>}>
          <div className="lectura-monto">{pesos(lectura.gasto.monto)}</div>
          <div className="lectura-detalle"><b>{lectura.gasto.concepto}</b><span>{[lectura.gasto.categoria, lectura.gasto.metodo, lectura.gasto.comercio].filter(Boolean).join(' · ')}</span></div>
          <p className="texto-suave">Quedó guardado como “Por revisar”. Confírmalo cuando verifiques que está bien.</p>
        </Hoja>
      )}
      {lectura && !lectura.ok && (
        <Hoja titulo="No pude leer el recibo" cerrar={() => setLectura(null)}
          pie={<div className="acciones-fila"><button className="btn-secundario" onClick={() => setLectura(null)}>Cerrar</button><button className="btn-principal" onClick={aMano}>Registrar a mano</button></div>}>
          <p>{lectura.mensaje}</p>
          <p className="texto-suave">Puedes registrarlo a mano y la foto queda adjunta.</p>
        </Hoja>
      )}
      {aviso && <div className="aviso" role="status">{aviso}</div>}
    </div>
  )
}

function Pendiente({ perfil, reintentar }) {
  return (
    <div className="pantalla-centro">
      <span className="marca">delú</span>
      <h1 className="titulo-centro">Tu cuenta espera aprobación</h1>
      <p className="texto-suave">El administrador debe activar tu acceso desde Ajustes → Usuarios. Cuando lo haga, toca “Revisar de nuevo”.</p>
      <p className="texto-suave">{perfil.email}</p>
      <button className="btn-principal" onClick={reintentar}>Revisar de nuevo</button>
      <button className="btn-texto" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  )
}
