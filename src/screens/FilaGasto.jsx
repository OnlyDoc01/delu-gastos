import { fechaCorta, pesos } from '../lib/format'

export default function FilaGasto({ g, categorias, metodos, onClick, conFecha }) {
  const c = categorias.find((x) => x.id === g.categoria_id)
  const m = metodos.find((x) => x.id === g.metodo_pago_id)
  const titulo = g.descripcion || g.proveedor || c?.nombre || 'Gasto'
  const sub = [c?.nombre, g.descripcion ? g.proveedor : null, m?.nombre, conFecha ? fechaCorta(g.fecha) : null].filter(Boolean).join(', ')
  return (
    <li>
      <button className="fila-gasto" onClick={onClick}>
        <span className="fg-ic" style={{ '--c': c?.color || '#999' }} aria-hidden="true">{c?.icono || '•'}</span>
        <span className="fg-txt">
          <span className="fg-t">{titulo}</span>
          <span className="fg-s">{sub}{g.factura_path ? ' · con factura' : ''}</span>
        </span>
        <span className="fg-monto">{pesos(g.monto)}</span>
      </button>
    </li>
  )
}
