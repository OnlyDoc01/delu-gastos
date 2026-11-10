import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { cargarCatalogos } from './lib/data'
import Login from './screens/Login'
import Inicio from './screens/Inicio'
import Lista from './screens/Lista'
import Registro from './screens/Registro'
import Exportar from './screens/Exportar'
import Ajustes from './screens/Ajustes'
import { Icono } from './ui'

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

  const ctx = {
    perfil, userId: sesion.user.id, esAdmin: perfil.rol === 'admin',
    ...cat, version, notificar,
    recargarCatalogos: async () => setCat(await cargarCatalogos()),
    editar: (g) => setEditando(g),
  }

  return (
    <div className="app">
      <main className="contenido">
        {tab === 'inicio' && <Inicio {...ctx} irA={setTab} />}
        {tab === 'lista' && <Lista {...ctx} />}
        {tab === 'exportar' && <Exportar {...ctx} />}
        {tab === 'ajustes' && <Ajustes {...ctx} />}
      </main>

      <nav className="barra" aria-label="Secciones">
        {TABS.map(([id, label, ic]) => id === 'nuevo' ? (
          <button key={id} className="barra-nuevo" onClick={() => setEditando({})} aria-label="Registrar gasto">
            <Icono n="mas" />
          </button>
        ) : (
          <button key={id} className={'barra-item' + (tab === id ? ' activo' : '')} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icono n={ic} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {editando && (
        <Registro
          {...ctx}
          gasto={editando}
          cerrar={() => setEditando(null)}
          alGuardar={(msg) => { setEditando(null); setVersion((v) => v + 1); notificar(msg) }}
        />
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
