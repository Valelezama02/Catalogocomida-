# Despensa — catálogo de comida de la casa

App personal (web instalable en el celular) para que el mercado quincenal alcance:
que no falte nada entre semana y que nada se dañe en la nevera. **Sin IA**: todo son reglas fijas y ajustables.

- **Qué hay**: inventario por lotes con fecha de vencimiento estimada (nevera / despensa / congelador).
- **Anotar**: usé, se dañó, conté, congelé. Lo que nadie anota se estima según quién está en la casa cada día.
- **Facturas**: foto de la factura física → se lee (OCR en el celular) → pantalla para revisar y corregir. También a mano si se perdió la factura.
- **Mercado**: cuestionario de la quincena (quiénes están, comidas, domingos, visitas) → lista agrupada por sección, con qué congelar al llegar.
- **Alertas**: lo vencido, lo que se vence en 2 días y lo que se acaba antes del próximo mercado.

Plan completo y decisiones: [docs/PLAN.md](docs/PLAN.md).

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pruebas del motor de cálculo
npm run build    # versión para publicar (carpeta dist/)
```

Código:

- `src/domain/` — el "cerebro": reglas de consumo (`household.ts`), inventario, lista y alertas (`engine.ts`), lectura de facturas (`receipt.ts`), catálogo inicial (`seed.ts`).
- `src/screens/` — pantallas.
- `src/state/store.tsx` — datos (por ahora guardados en el celular).
