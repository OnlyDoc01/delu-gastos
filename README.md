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
- Usuarios: la primera cuenta creada es administrador; las siguientes quedan “sin acceso” hasta que el administrador las apruebe en Ajustes → Usuarios. Quien “registra gastos” solo ve lo suyo.

## Técnica
- React + Vite, PWA (`vite-plugin-pwa`).
- Base de datos, inicio de sesión y fotos en Supabase (proyecto `delu-gastos`), protegidos con RLS. Esquema en `supabase/schema.sql`.
- Cada push a `main` se publica solo en GitHub Pages (`.github/workflows/deploy.yml`).

```bash
npm install
npm run dev     # desarrollo local
npm run build   # compilación
```
