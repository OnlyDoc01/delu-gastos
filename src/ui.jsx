const P = {
  inicio: 'M4 19V10M10 19V5M16 19v-7M22 19H2',
  lista: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  mas: 'M12 5v14M5 12h14',
  excel: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 13l4 5M13 13l-4 5',
  ajustes: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M8 10v4M16 16v4',
  cerrar: 'M6 6l12 12M18 6L6 18',
  camara: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  borrar: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  atras: 'M15 18l-6-6 6-6',
  retroceso: 'M21 5H9l-6 7 6 7h12zM13 9l5 6M18 9l-5 6',
  descargar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  imagen: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
}

export function Icono({ n, tam = 22 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[n]} />
    </svg>
  )
}

export function Hoja({ titulo, cerrar, children, pie }) {
  return (
    <div className="hoja-fondo" onClick={cerrar}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header className="hoja-cab">
          <h2>{titulo}</h2>
          <button className="btn-icono" onClick={cerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
        </header>
        <div className="hoja-cuerpo">{children}</div>
        {pie && <footer className="hoja-pie">{pie}</footer>}
      </div>
    </div>
  )
}

export function Chips({ opciones, valor, cambiar, todos }) {
  return (
    <div className="chips" role="radiogroup">
      {todos && (
        <button type="button" role="radio" aria-checked={!valor} className={'chip' + (!valor ? ' sel' : '')} onClick={() => cambiar('')}>{todos}</button>
      )}
      {opciones.map((o) => (
        <button type="button" role="radio" aria-checked={valor === o.id} key={o.id}
          className={'chip' + (valor === o.id ? ' sel' : '')}
          style={o.color ? { '--c': o.color } : undefined}
          onClick={() => cambiar(valor === o.id && todos ? '' : o.id)}>
          {o.icono && <span className="chip-ic">{o.icono}</span>}{o.nombre}
        </button>
      ))}
    </div>
  )
}

export function Vacio({ titulo, texto, accion }) {
  return (
    <div className="vacio">
      <p className="vacio-t">{titulo}</p>
      {texto && <p className="texto-suave">{texto}</p>}
      {accion}
    </div>
  )
}
