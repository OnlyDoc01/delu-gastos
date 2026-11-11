import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Hoja, Icono } from '../ui'

const COLORES = ['#B07D62', '#6B7F99', '#5F9E8F', '#9A6FB0', '#D1795B', '#C9A24A', '#7FA35A', '#8F8F8F', '#A85A5A', '#4E7FA8', '#C46F94', '#7A6A5F']

const URL_LECTOR = 'https://gcionnovhpskxaaugzmf.supabase.co/functions/v1/leer-comprobante'

export default function Ajustes({ perfil, userId, esAdmin, categorias, metodos, recargarCatalogos, notificar }) {
  const [hoja, setHoja] = useState(null)

  return (
    <div className="pantalla">
      <header className="pantalla-cab">
        <h1>Ajustes</h1>
      </header>

      <section className="tarjeta-perfil">
        <div className="avatar" aria-hidden="true">{(perfil.nombre || '?').charAt(0).toUpperCase()}</div>
        <div>
          <p className="tp-nombre">{perfil.nombre}</p>
          <p className="texto-suave">{perfil.email} · {perfil.rol === 'admin' ? 'Administrador' : 'Registra gastos'}</p>
        </div>
      </section>

      {esAdmin && (
        <ul className="menu">
          <li><button onClick={() => setHoja('cat')}><span>Categorías</span><span className="texto-suave">{categorias.filter((c) => c.activa).length} activas</span></button></li>
          <li><button onClick={() => setHoja('met')}><span>Métodos de pago</span><span className="texto-suave">{metodos.filter((m) => m.activo).length} activos</span></button></li>
          <li><button onClick={() => setHoja('usr')}><span>Usuarios del equipo</span><span className="texto-suave">Aprobar y asignar roles</span></button></li>
        </ul>
      )}

      <ul className="menu">
        <li><button onClick={() => setHoja('atajo')}><span>Atajo para compartir comprobantes</span><span className="texto-suave">iPhone</span></button></li>
        <li><button onClick={() => setHoja('instalar')}><span>Instalar en el iPhone</span></button></li>
        <li><button onClick={() => supabase.auth.signOut()}><span className="rojo">Cerrar sesión</span></button></li>
      </ul>

      {hoja === 'cat' && <EditorCatalogo titulo="Categorías" tabla="categorias" campoActivo="activa" items={categorias} conColor recargar={recargarCatalogos} cerrar={() => setHoja(null)} notificar={notificar} />}
      {hoja === 'met' && <EditorCatalogo titulo="Métodos de pago" tabla="metodos_pago" campoActivo="activo" items={metodos} recargar={recargarCatalogos} cerrar={() => setHoja(null)} notificar={notificar} />}
      {hoja === 'usr' && <Usuarios cerrar={() => setHoja(null)} yo={perfil.id} notificar={notificar} />}
      {hoja === 'atajo' && <Atajo cerrar={() => setHoja(null)} userId={userId} notificar={notificar} />}
      {hoja === 'instalar' && (
        <Hoja titulo="Instalar en el iPhone" cerrar={() => setHoja(null)}>
          <ol className="pasos">
            <li>Abre esta página en <strong>Safari</strong>.</li>
            <li>Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
            <li>Elige <strong>Agregar a inicio</strong> y toca <strong>Agregar</strong>.</li>
            <li>Abre “Gastos” desde el ícono nuevo de tu pantalla de inicio.</li>
          </ol>
          <p className="texto-suave">Las actualizaciones llegan solas: no hay que reinstalar.</p>
        </Hoja>
      )}
    </div>
  )
}

async function huella(texto) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const cuando = (ts) => new Date(ts).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })

function Atajo({ cerrar, userId, notificar }) {
  const [estado, setEstado] = useState(undefined) // undefined: cargando, null: sin llave
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState('')

  const cargar = () => supabase.from('atajo_tokens').select('creado_en, ultimo_uso').eq('user_id', userId).maybeSingle()
    .then(({ data, error }) => { setEstado(data || null); if (error) setError(error.message) })
  useEffect(() => { cargar() }, []) // eslint-disable-line

  async function copiar(texto, msg) {
    try { await navigator.clipboard.writeText(texto); notificar(msg) } catch { notificar('No se pudo copiar. Mantén presionado el texto para copiarlo.') }
  }

  async function crear() {
    setError('')
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    const token = 'dg_' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    const borrar = await supabase.from('atajo_tokens').delete().eq('user_id', userId)
    if (borrar.error) return setError(borrar.error.message)
    const { error } = await supabase.from('atajo_tokens').insert({ token_hash: await huella(token) })
    if (error) return setError(error.message)
    setNueva(token); cargar()
  }

  async function eliminar() {
    if (!confirm('¿Eliminar la llave? El atajo dejará de funcionar hasta que crees otra.')) return
    const { error } = await supabase.from('atajo_tokens').delete().eq('user_id', userId)
    if (error) return setError(error.message)
    setNueva(''); cargar(); notificar('Llave eliminada')
  }

  return (
    <Hoja titulo="Atajo para comprobantes" cerrar={cerrar}>
      <p className="texto-suave">Comparte el comprobante de una transferencia desde tu banco o Nequi y el gasto queda registrado como “Por revisar”. Tú lo confirmas en la app.</p>
      {error && <p className="error">{error}</p>}

      <section className="grupo">
        <h3>1. Tu llave</h3>
        {nueva && (
          <div className="llave-nueva">
            <p><strong>Copia esta llave ahora.</strong> No se vuelve a mostrar.</p>
            <code className="codigo">{nueva}</code>
            <button className="btn-secundario" onClick={() => copiar(nueva, 'Llave copiada')}>Copiar llave</button>
          </div>
        )}
        {estado && !nueva && (
          <p className="texto-suave">Llave activa desde {cuando(estado.creado_en)}. {estado.ultimo_uso ? `Último uso: ${cuando(estado.ultimo_uso)}.` : 'Aún no se ha usado.'}</p>
        )}
        <div className="acciones-fila">
          <button className="btn-secundario" onClick={crear} disabled={estado === undefined}>{estado ? 'Crear llave nueva' : 'Crear llave'}</button>
          {estado && <button className="btn-texto rojo" onClick={eliminar}>Eliminar llave</button>}
        </div>
        {estado && <p className="nota">Si creas una llave nueva, la anterior deja de funcionar y debes cambiarla en el atajo.</p>}
      </section>

      <section className="grupo">
        <h3>2. Dirección del servicio</h3>
        <code className="codigo">{URL_LECTOR}</code>
        <button className="btn-secundario" onClick={() => copiar(URL_LECTOR, 'Dirección copiada')}>Copiar dirección</button>
      </section>

      <section className="grupo">
        <h3>3. Crea el atajo (una sola vez)</h3>
        <ol className="pasos">
          <li>Abre la app <strong>Atajos</strong> de Apple, toca <strong>+</strong> y ponle de nombre <strong>Registrar en Delú</strong>.</li>
          <li>Abre los detalles del atajo (ícono <strong>i</strong>), activa <strong>Mostrar en la hoja de compartir</strong> y en los tipos aceptados deja solo <strong>Imágenes</strong>.</li>
          <li>Agrega <strong>Convertir imagen</strong> sobre la <strong>Entrada del atajo</strong> y elige <strong>JPEG</strong>.</li>
          <li>Agrega <strong>Cambiar tamaño de imagen</strong> y pon ancho <strong>1600</strong>.</li>
          <li>Agrega <strong>Obtener contenido de URL</strong>. Pega la dirección del paso 2, toca <strong>Mostrar más</strong> y configura: método <strong>POST</strong>; en encabezados agrega <strong>Authorization</strong> con el valor <strong>Bearer </strong> seguido de tu llave (con un espacio en medio); cuerpo de la solicitud <strong>Formulario</strong>, con un campo de tipo <strong>Archivo</strong> llamado <strong>imagen</strong> cuyo valor sea la imagen con tamaño cambiado.</li>
          <li>Agrega <strong>Obtener valor del diccionario</strong> con la clave <strong>mensaje</strong>.</li>
          <li>Agrega <strong>Mostrar notificación</strong> con ese valor.</li>
        </ol>
        <p className="nota">Los nombres de las acciones pueden variar un poco según tu versión de iOS.</p>
      </section>

      <section className="grupo">
        <h3>4. Úsalo</h3>
        <p className="texto-suave">En tu banco o Nequi abre el comprobante, toca <strong>Compartir</strong> y elige <strong>Registrar en Delú</strong>. Si no aparece en la lista, baja hasta <strong>Más</strong> y actívalo. Te llega una notificación con lo que se leyó, y en Resumen verás el aviso para revisarlo. También funciona con una captura de pantalla desde Fotos.</p>
      </section>
    </Hoja>
  )
}

function EditorCatalogo({ titulo, tabla, campoActivo, items, conColor, recargar, cerrar, notificar }) {
  const [nuevo, setNuevo] = useState('')
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState('')

  async function op(p, msg) {
    setError('')
    const { error } = await p
    if (error) { setError(error.code === '23505' ? 'Ya existe uno con ese nombre.' : error.message); return false }
    await recargar(); if (msg) notificar(msg); return true
  }

  async function agregar(e) {
    e.preventDefault()
    const nombre = nuevo.trim(); if (!nombre) return
    const fila = { nombre, orden: items.length + 1 }
    if (conColor) fila.color = COLORES[items.length % COLORES.length]
    if (await op(supabase.from(tabla).insert(fila), 'Agregado')) setNuevo('')
  }

  return (
    <Hoja titulo={titulo} cerrar={cerrar}>
      <form className="agregar" onSubmit={agregar}>
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre nuevo" aria-label="Nombre nuevo" />
        <button className="btn-principal" disabled={!nuevo.trim()}>Agregar</button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul className="catalogo">
        {items.map((it) => (
          <li key={it.id} className={it[campoActivo] ? '' : 'archivado'}>
            {editando?.id === it.id ? (
              <form className="cat-edicion" onSubmit={async (e) => {
                e.preventDefault()
                const cambios = { nombre: editando.nombre.trim() }
                if (conColor) { cambios.color = editando.color; cambios.icono = editando.icono || '•' }
                if (await op(supabase.from(tabla).update(cambios).eq('id', it.id), 'Guardado')) setEditando(null)
              }}>
                <div className="cat-ed-fila">
                  {conColor && <input className="cat-icono-in" value={editando.icono} maxLength={2} onChange={(e) => setEditando({ ...editando, icono: e.target.value })} aria-label="Emoji" />}
                  <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} aria-label="Nombre" />
                </div>
                {conColor && (
                  <div className="paleta">
                    {COLORES.map((c) => (
                      <button type="button" key={c} className={'color' + (editando.color?.toUpperCase() === c ? ' sel' : '')} style={{ background: c }} onClick={() => setEditando({ ...editando, color: c })} aria-label={'Color ' + c} />
                    ))}
                  </div>
                )}
                <div className="cat-ed-acciones">
                  <button type="button" className="btn-texto" onClick={() => setEditando(null)}>Cancelar</button>
                  <button className="btn-principal">Guardar</button>
                </div>
              </form>
            ) : (
              <div className="cat-fila">
                {conColor && <span className="fg-ic" style={{ '--c': it.color }} aria-hidden="true">{it.icono}</span>}
                <span className="cat-nombre">{it.nombre}{!it[campoActivo] && <span className="texto-suave"> (archivada)</span>}</span>
                <button className="btn-texto" onClick={() => setEditando({ ...it })}>Editar</button>
                <button className="btn-texto" onClick={() => op(supabase.from(tabla).update({ [campoActivo]: !it[campoActivo] }).eq('id', it.id), it[campoActivo] ? 'Archivado' : 'Activado')}>
                  {it[campoActivo] ? 'Archivar' : 'Activar'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="nota">Archivar oculta la opción al registrar, pero conserva los gastos anteriores con su categoría.</p>
    </Hoja>
  )
}

function Usuarios({ cerrar, yo, notificar }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState('')
  const cargar = () => supabase.from('perfiles').select('*').order('creado_en').then(({ data, error }) => { setLista(data); if (error) setError(error.message) })
  useEffect(() => { cargar() }, [])

  async function cambiar(id, rol) {
    const { error } = await supabase.from('perfiles').update({ rol }).eq('id', id)
    if (error) setError(error.message); else { notificar('Rol actualizado'); cargar() }
  }

  return (
    <Hoja titulo="Usuarios del equipo" cerrar={cerrar}>
      <p className="texto-suave">Para sumar a alguien, pídele que abra la app y toque “Crear cuenta”. Aparecerá aquí como pendiente.</p>
      {error && <p className="error">{error}</p>}
      <ul className="usuarios">
        {(lista || []).map((u) => (
          <li key={u.id}>
            <div>
              <p className="tp-nombre">{u.nombre}{u.id === yo && ' (tú)'}</p>
              <p className="texto-suave">{u.email}</p>
            </div>
            <select value={u.rol} disabled={u.id === yo} onChange={(e) => cambiar(u.id, e.target.value)} aria-label={'Rol de ' + u.nombre}>
              <option value="pendiente">Sin acceso</option>
              <option value="registrador">Registra gastos</option>
              <option value="admin">Administrador</option>
            </select>
          </li>
        ))}
      </ul>
      <p className="nota"><Icono n="ajustes" tam={14} /> “Registra gastos” solo ve lo que esa persona registró. El administrador ve todo, los reportes y el Excel completo.</p>
    </Hoja>
  )
}
