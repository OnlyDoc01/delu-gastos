# Delú Gastos

App para registrar y controlar los gastos del local de Delú. Se instala en el iPhone desde Safari (sin App Store).

**App:** https://onlydoc01.github.io/delu-gastos/

## Instalar en el iPhone
1. Abre el enlace en **Safari**.
2. Toca **Compartir** → **Agregar a inicio** → **Agregar**.
3. Abre “Gastos” desde el ícono nuevo.

## Funciones
- Registro rápido: monto con teclado grande, categoría, método de pago, fecha, proveedor, nota y foto de la factura.
- Resumen del mes con gasto por categoría y comparación contra el mismo corte del mes anterior.
- Lista con búsqueda y filtros por periodo, categoría y método de pago.
- Descarga en Excel por periodo (hoja de detalle + hoja de resumen).
- Categorías y métodos de pago editables.
- Atajo de iPhone: compartes el comprobante de una transferencia desde el banco o Nequi y un servicio lo lee con Claude y crea el gasto como “Por revisar” (con la foto adjunta). Se confirma desde la app. Pasos dentro de la app: Ajustes → Atajo para compartir comprobantes.
- Usuarios: la primera cuenta creada es administrador; las siguientes quedan “sin acceso” hasta que el administrador las apruebe en Ajustes → Usuarios. Quien “registra gastos” solo ve lo suyo.

## Técnica
- React + Vite, PWA (`vite-plugin-pwa`).
- Base de datos, inicio de sesión y fotos en Supabase (proyecto `delu-gastos`), protegidos con RLS. Esquema en `supabase/schema.sql`.
- Cada push a `main` se publica solo en GitHub Pages (`.github/workflows/deploy.yml`).

### Servicio que lee comprobantes
Vive en `supabase/functions/leer-comprobante/` (Supabase Edge Function, no se publica con GitHub Pages: se despliega aparte en Supabase).
- Necesita el secreto `ANTHROPIC_API_KEY` en Supabase → Edge Functions → Secrets.
- Modelo por defecto `claude-haiku-5-5`; se puede cambiar con el secreto opcional `MODELO_LECTURA` (por ejemplo `claude-sonnet-5-5` si la lectura falla con frecuencia).
- Se autentica con la llave personal que cada usuario crea en la app (se guarda solo su huella SHA-256) y limita a 40 lecturas por hora por usuario.

```bash
npm install
npm run dev     # desarrollo local
npm run build   # compilación
```
