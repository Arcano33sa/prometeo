# PROMETEO — v1.33 White-Label Base

Aplicación web estática, local-first y sin backend obligatorio para un pequeño emprendimiento de ropa.

## PROMETEO v1.33
- Inventario con productos, variantes, fotos, existencias físicas y disponibilidad real.
- Ventas de contado y crédito con descuento fijo por pieza, snapshots de precio/costo y utilidad real histórica.
- Clientes, estados de cuenta y copia manual para compartir.
- Cobros, abonos, saldos y vencimientos.
- Compras, proveedores, pagos y cuentas por pagar.
- Apartados con reserva de disponibilidad sin descontar existencia física hasta completar.
- Cambios y devoluciones con historial y movimientos de inventario.
- Gastos y tablero operativo por período.
- Catálogo visual completo / solo disponibles y exportación PDF local.
- Respaldo JSON completo con validación previa e inclusión de fotos almacenadas en IndexedDB.
- PWA instalable con manifest, iconos, Service Worker versionado, limpieza de cachés antiguas y soporte offline del shell principal.
- Métodos de pago limitados a Efectivo, Transferencia y Tarjeta.

## Abrir
Servir el directorio con un servidor web estático. Por ejemplo:

```bash
python3 -m http.server 8080
```

Luego abrir `http://localhost:8080/`.

> Para instalar la PWA y probar Service Worker se requiere HTTP/HTTPS (localhost es válido). Abrir directamente con `file://` no activa Service Worker.
