import { useState } from 'react'
import { supabase } from '../supabase'

const ERRORES = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'User already registered': 'Ese correo ya tiene cuenta. Inicia sesión.',
  'Email not confirmed': 'Confirma tu correo con el enlace que te llegó y vuelve a intentar.',
}

export default function Login() {
  const [modo, setModo] = useState('entrar')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError(''); setInfo(''); setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
        if (error) throw error
      } else if (modo === 'crear') {
        if (clave.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
        const { data, error } = await supabase.auth.signUp({
          email, password: clave,
          options: { data: { nombre }, emailRedirectTo: location.origin + location.pathname },
        })
        if (error) throw error
        if (!data.session) setInfo('Te enviamos un correo para confirmar la cuenta. Ábrelo desde este teléfono y luego inicia sesión.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
        if (error) throw error
        setInfo('Te enviamos un enlace para cambiar la contraseña.')
      }
    } catch (err) {
      setError(ERRORES[err.message] || err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <div className="login-marca">
        <span className="marca grande">delú</span>
        <p>Gastos del local, en orden.</p>
      </div>
      <form className="login-form" onSubmit={enviar}>
        <h1>{modo === 'entrar' ? 'Iniciar sesión' : modo === 'crear' ? 'Crear cuenta' : 'Recuperar contraseña'}</h1>
        {modo === 'crear' && (
          <label className="campo"><span>Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label className="campo"><span>Correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
        </label>
        {modo !== 'recuperar' && (
          <label className="campo"><span>Contraseña</span>
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} required />
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {info && <p className="info">{info}</p>}
        <button className="btn-principal" disabled={enviando}>
          {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
        <div className="login-links">
          {modo !== 'entrar' && <button type="button" className="btn-texto" onClick={() => setModo('entrar')}>Ya tengo cuenta</button>}
          {modo !== 'crear' && <button type="button" className="btn-texto" onClick={() => setModo('crear')}>Crear cuenta</button>}
          {modo === 'entrar' && <button type="button" className="btn-texto" onClick={() => setModo('recuperar')}>Olvidé mi contraseña</button>}
        </div>
      </form>
    </div>
  )
}
