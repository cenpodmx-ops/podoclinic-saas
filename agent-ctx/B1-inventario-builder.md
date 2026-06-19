# Task B1 — Inventario builder

## Work Log
- Leí worklog previo (Bloque A completo y verificado por main agent Task 10; B2 Caja/Finanzas por otro agente; B4 Recetas por otro agente).
- Revisé el schema Prisma (modelos Product, StockMovement, CashSession, CashMovement, Clinic), lib/api.ts (requireSession, effectiveClinic, ok, bad), lib/format.ts (fmtMoney, fmtDateTime), lib/session.ts (SessionUser con clinicId).
- Revisé el API existente /api/inventario/route.ts que solo tenía GET ?q= (para Consulta). Lo extendí sin romperlo.
- Revisé la página existente /inventario (era ComingSoon).
- Revisé los componentes ya existentes: ProductAdder (consulta), PatientCard/TicketPreview (consulta), app-shell, modules.ts (inventario en group 'finanzas', roles SUPER/OWNER/RECEPTION).
- Instalé `xlsx` (v0.18.5) para parsing de Excel en /api/inventario/importar.

## APIs creadas/extendidas (todas bajo /api/inventario/* y /api/ventas-mostrador)
- `GET /api/inventario?q=<texto>` → quick search {rows:[...]} — **mantenido** para Consulta module. Devuelve id, code, name, category, salePrice, costPrice, stock, minStock, ivaType. Take 30, active=true.
- `GET /api/inventario?page=1&limit=20&category=&stockBajo=1&includeInactive=0&all=1` → listado paginado {data, total, page, limit}. Cada producto incluye `stockBajo` boolean. SUPER con ?all=1 ve todas las clínicas.
- `POST /api/inventario` → crear producto. Body: {name, description?, code?, category, costPrice, salePrice, ivaType, stock, minStock, supplier?, clinicId?}. 403 si RECEPTION/PODOLOGIST. Crea StockMovement ENTRADA inicial si stock>0.
- `GET /api/inventario/[id]` → detalle + clinic + últimos 20 movimientos. Cross-clinic guard (SUPER puede ver cualquiera).
- `PATCH /api/inventario/[id]` → actualizar campos. 403 si RECEPTION/PODOLOGIST. Si cambia stock directo, crea StockMovement AJUSTE (diff).
- `DELETE /api/inventario/[id]` → soft delete (active=false). 403 si RECEPTION/PODOLOGIST.
- `GET /api/inventario/[id]/movimientos?page=&limit=` → lista paginada {data, total, page, limit}.
- `POST /api/inventario/[id]/movimientos` → registrar movimiento {type: ENTRADA|AJUSTE, quantity, reason?, cost?, supplier?}. SALIDA y VENTA son solo system-generated (403 si se intentan). Valida stock no negativo. 403 si RECEPTION/PODOLOGIST.
- `POST /api/ventas-mostrador` → POS. Body: {items:[{productId, qty}], paymentMethod, descontarStock=true}. Valida stock, crea StockMovement SALIDA por item, decrementa product.stock, get-or-create CashSession de hoy, crea CashMovement INGRESO source='MOSTRADOR'. Retorna {ticketId, date, total, subtotal, ivaTotal, paymentMethod, items, clinic, cashier}. 403 si PODOLOGIST (RECEPTION puede, OWNER/SUPER pueden).
- `POST /api/inventario/importar` → multipart/form-data con campo `file` (.xlsx, .xls, .csv). Parsea con xlsx (Excel) o parser CSV manual. Headers: name, category, costPrice, salePrice, ivaType, stock, minStock, supplier. Valida cada fila (categoría, IVA, código duplicado en archivo y en BD). Crea productos válidos + StockMovement ENTRADA inicial si stock>0. Retorna {imported, errors:[{row, error}]}. 403 si RECEPTION/PODOLOGIST.
- `GET /api/inventario/plantilla` → text/csv con headers + 2 filas de ejemplo. Content-Disposition: attachment. PODELOGIST 403.

## Page `/inventario` (src/app/(app)/inventario/page.tsx)
- Top bar: botones "Venta mostrador" (outline azul), "Importar Excel" (solo OWNER/SUPER), "Nuevo producto" (solo OWNER/SUPER).
- Stock bajo alert: banner rojo con cantidad + badges clickeables que abren el dialog de movimientos del producto.
- Toolbar: búsqueda debounced 300ms, select de categoría (Todas/Medicamento/Producto/Material/Equipo), switch "stock bajo", switch "ver inactivos", contador dinámico de productos.
- Tabla: nombre (con code y description), categoría (badge), precio venta, IVA (badge), stock (badge rojo si <= minStock, verde si no), proveedor, estado (activo/inactivo), acciones (movimientos / editar / desactivar).
- Click en fila abre diálogo de edición.
- Paginación simple (Anterior/Siguiente + página X de Y).
- Diálogos:
  * ProductFormDialog (nuevo/editar): todos los campos, con select de categoría e IVA. Si el usuario es RECEPTION, se abre como solo lectura (sin botón Guardar).
  * MovimientosDialog: historial paginado + formulario de registro (ENTRADA/AJUSTE, cantidad, costo unit., proveedor, motivo).
  * ImportDialog: botón descargar plantilla, input file (xlsx/csv), preview de hasta 50 filas parseadas client-side, confirmación → POST al backend, alerta de errores por fila, alerta de éxito.
  * PosDialog: buscador de productos con dropdown, carrito editable (qty +/-, remove), método de pago, switch "descontar stock", totales (subtotal/IVA/total), botón "Cobrar", ticket imprimible (mismo estilo monoespaciado 80mm del consulta).

## Componentes en src/app/(app)/inventario/_components/
- types.ts: constantes (CATEGORIES, IVA_TYPES, PAYMENT_METHODS, MOVEMENT_TYPE_LABELS) y tipos (Product, StockMovement, CartItem, VentaMostradorResponse).
- product-form-dialog.tsx: dialog con inner FormBody remount via key (evita setState-in-effect lint).
- movimientos-dialog.tsx: dialog con inner Body remount via key.
- import-dialog.tsx: dialog con descarga de plantilla, upload, preview client-side, confirmación server-side.
- pos-dialog.tsx: dialog POS con inner PosBody, ticket dialog secundario.

## Verificaciones
- `bun run lint`: 0 errores en TODO el proyecto (verificado `bunx eslint` sobre paths específicos y completo).
- `bunx tsc --noEmit`: 0 errores en mis archivos.
- Pruebas API con curl (dueno@cenpod.com, recepcion@cenpod.com, ricardo@cenpod.com):
  * GET /api/inventario?q=a → {rows:[...]} (5 productos) ✓ (compat Consulta)
  * GET /api/inventario?page=1&limit=5 → {data:[...], total, page, limit} ✓
  * POST como RECEPTION → 403 "No tienes permisos para crear productos" ✓
  * POST como OWNER → 201 con producto creado + StockMovement ENTRADA inicial ✓
  * GET /api/inventario/[id] → detalle + clinic + 1 movimiento inicial ✓
  * PATCH /api/inventario/[id] (salePrice, minStock) → 200 ✓
  * POST /api/inventario/[id]/movimientos ENTRADA +5 → 201, stock 10→15 ✓
  * POST /api/inventario/[id]/movimientos AJUSTE -2 → 201, stock 15→13 ✓
  * GET /api/inventario/[id]/movimientos → 3 movimientos en orden desc ✓
  * POST /api/ventas-mostrador (2 items) → 201 con ticketId, total=318.40 (240*1.16 + 40), stock decrementado (13→11) ✓
  * PATCH /api/inventario/[id] stock=2 (con minStock=5) → 200 + StockMovement AJUSTE -9 ✓
  * GET /api/inventario?stockBajo=1 → incluye el producto test con stock=2 <= minStock=5 ✓
  * DELETE /api/inventario/[id] → 200, active=false ✓ (soft delete)
  * GET /api/inventario?includeInactive=1 → incluye el inactivo ✓
  * GET /api/inventario (default, active=true) → NO incluye el inactivo ✓
  * GET /api/inventario/plantilla → 200 text/csv con headers + 2 ejemplos ✓
  * POST /api/inventario/importar (3 filas, 2 válidas + 1 con categoría inválida) → {imported:2, errors:[{row:3, error:"Categoría inválida..."}]} ✓
  * POST /api/inventario como PODOLOGIST → 403 ✓
  * POST /api/ventas-mostrador como PODOLOGIST → 403 ✓
  * POST /api/inventario/importar como PODOLOGIST → 403 ✓
- GET /inventario (render página como dueño): 200 en 836ms (compile 743ms first time), sin errores en dev.log.
- Limpié todos los datos de prueba (productos test + movimientos SALIDA + CashMovement MOSTRADOR + restauré Amoxicilina a stock=50).

## Stage Summary
- APIs: /api/inventario (GET extendido con ?q= preservado + paginación + POST), /api/inventario/[id] (GET/PATCH/DELETE), /api/inventario/[id]/movimientos (GET/POST), /api/ventas-mostrador (POST), /api/inventario/importar (POST multipart), /api/inventario/plantilla (GET CSV).
- Page: /inventario con top bar (búsqueda + filtros + 3 acciones), banner stock bajo clickeable, tabla responsive con acciones por fila, paginación, 4 diálogos (form producto, movimientos, importar, POS con ticket imprimible).
- Permisos: PODOLOGIST 403 en todas las escrituras. RECEPTION puede ver + venta mostrador pero NO crear/editar/eliminar productos ni registrar movimientos manuales. OWNER/SUPER todo.
- Consulta module compatibilidad: GET ?q= devolviendo {rows:[...]} preservado exactamente.
- Sin errores de lint ni TS en mis archivos. Sin errores de compile en dev.log.
