# Catálogo Comida — Plan del proyecto

> App personal para que el mercado quincenal alcance: que no falte nada entre semana y que nada se dañe en la nevera.
> **Sin inteligencia artificial**: todo funciona con reglas fijas ("si pasa X con estas variables, entonces A, B o C") que tú puedes ver y ajustar.

---

## 1. El problema, en concreto

| Síntoma | Causa de fondo | Qué hace la app |
|---|---|---|
| En el mercado se olvida algo | La lista se hace de memoria | La lista **la genera la app** a partir de lo que hay y lo que se va a consumir |
| A mitad de semana se acaba A, B o C | Nadie calcula cuánto consume la casa en 15 días | Calcula el consumo según **quién está en la casa cada día** |
| La comida se daña en la nevera | Nadie sabe qué está por vencerse | Lleva la **fecha de compra y vida útil** de cada cosa y avisa "úsalo ya" |
| Se compra de más o de menos | No hay historial | Guarda compras y usos, y **se autocorrige** con el tiempo |

---

## 2. La casa (variables base)

| Persona | Tipo | Días | Comidas en casa |
|---|---|---|---|
| Adulto 1, 2 y 3 | Adulto residente | Lun–Dom | Desayuno, almuerzo, cena |
| Rosita | Interna | Lun–Dom | Desayuno, almuerzo, cena |
| Tati | Empleada | Mar–Sáb | Desayuno, almuerzo |
| Érica (nana) | Empleada | Lun–Vie | Desayuno, almuerzo |
| Gracia | Bebé (2 años) | Lun–Dom | Menú propio (3 comidas + 2 meriendas) |

**Regla de cocina:** para los 4 que viven en la casa, **la cena es lo mismo que el almuerzo**. Entonces cada día se cocina una sola tanda grande:

| Día | Almuerzo | Cena (mismo plato) | **Porciones a cocinar** | Desayunos |
|---|---|---|---|---|
| Lunes | 4 + Érica = 5 | 4 | **9** | 5 |
| Mar–Vie | 4 + Tati + Érica = 6 | 4 | **10** | 6 |
| Sábado | 4 + Tati = 5 | 4 | **9** | 5 |
| Domingo | 4 | 4 | **8** | 4 |
| **Semana** | | | **66 porciones** | **38 desayunos** |
| **Quincena** | | | **≈141 porciones** | **≈81 desayunos** |

Más Gracia aparte. Esto **lo calcula la app sola** a partir del horario de cada persona; si alguien se va de viaje o hay visita, se marca y el cálculo cambia.

---

## 3. Las 3 funciones principales

### 3.1 Catálogo + inventario ("qué hay y qué no hay")

Cada producto del catálogo tiene:

- **Nombre, categoría y lugar**: nevera, congelador, despensa, aseo, bebé.
- **Unidad y presentación**: ej. huevos (unidad, cubeta de 30), arroz (g, bolsa de 5 kg), jabón de manos (ml, frasco de 500 ml).
- **Vida útil**: cerrado y abierto, y según el lugar (ej. pollo: 2 días en nevera / 90 días congelado).
- **Regla de consumo** (cómo se gasta, ver sección 4).
- **Stock mínimo / colchón de seguridad**.

El inventario se mueve con 4 tipos de eventos:

1. **Compra** (+) — por factura o a mano.
2. **Uso registrado** (−) — "usé 6 huevos", "usé 1 kg de carne".
3. **Consumo estimado** (−) — automático, para lo que nadie registra (jabón, papel, aceite…).
4. **Conteo / corrección** (=) — "abrí la nevera y quedan 4 huevos". Esto pone el stock en la realidad **y calibra** las reglas.

Y también **Descarte** (se dañó): queda registrado para aprender qué se está comprando de más.

### 3.2 Registro de compras (escanear facturas)

Tres caminos, de más confiable a menos:

1. **Factura electrónica (recomendado).** En Colombia los supermercados (Éxito, Carulla, D1, Ara, Olímpica, Jumbo…) están obligados a emitir factura electrónica DIAN, que llega al correo con un **XML** adjunto. Ese XML trae cada línea con descripción, cantidad y precio en un formato estándar → se lee **100% exacto, sin IA**. Solo hay que subir el archivo.
2. **Foto de la factura en papel.** Se usa OCR (reconocimiento de texto, ej. Tesseract, corre en el celular) + reglas para separar líneas. Es menos exacto, por eso siempre sale una **pantalla de revisión** antes de guardar.
3. **A mano** — lista rápida con buscador.

**Diccionario de equivalencias:** la factura dice "HUEVO AA ROJO X30 KIKES"; la primera vez tú le dices "eso es *Huevos*, 30 unidades". La app lo recuerda y la próxima vez lo reconoce solo.

### 3.3 Lista del mercado de la quincena

Para cada producto, la fórmula es:

```
necesito = consumo_proyectado(hasta la próxima quincena)
         + colchón de seguridad (ej. 3 días extra)
         − stock actual (sin contar lo que se vence antes de usarse)

a comprar = redondear_arriba(necesito / tamaño de presentación)
```

La lista sale **agrupada por pasillo/lugar** (frutas y verduras, carnes, lácteos, aseo, bebé…) y con lo **que ya hay** al lado, para no comprar repetido.

**Ojo con los perecederos** — hay cosas que físicamente no duran 15 días (lechuga, fresas, pan, algunos lácteos). La app los marca y propone una de estas estrategias (tú eliges cuál usar por producto):

- **Congelar**: carne/pollo/pescado porcionado el día de la compra (la app dice "porcionar en 8 bolsas de 500 g").
- **Ordenar el menú por caducidad**: lo más perecedero se come los primeros días; lo de larga duración (granos, congelados, enlatados) al final de la quincena.
- **Comprar en distinta madurez**: aguacate/banano/plátano verde y maduro.
- **Sustituir**: en la segunda semana, verdura de larga duración (zanahoria, repollo, ahuyama) en vez de hoja verde.

---

## 4. Motor de reglas de consumo (el "cerebro" sin IA)

Cada producto usa **una** de estas reglas:

| Tipo de regla | Se calcula con | Ejemplos |
|---|---|---|
| **Por porción** | porciones cocinadas × gramos por porción | arroz, carne, pollo, papa |
| **Por desayuno** | desayunos × cantidad | huevos, arepas, pan, café |
| **Por persona-día** | días-persona en casa × cantidad diaria | jabón de manos, papel higiénico, crema dental |
| **Fijo del hogar** | cantidad por semana | detergente ropa, lavaloza, bolsas de basura |
| **Bebé** | días × cantidad diaria de Gracia | pañales, leche, yogurt, frutas de Gracia |
| **Por receta** | ingredientes del menú planeado | ingredientes específicos (ver sección 5) |
| **Solo manual** | solo lo que se registra | cosas ocasionales |

Las empleadas cuentan como "media persona-día" en aseo personal (están solo parte del día); ese factor es configurable.

**Ejemplo — jabón de manos (valores de ejemplo, se ajustan):**

```
persona-días en la quincena:
  4 residentes × 15 días            = 60
  Gracia × 15 días                  = 15
  Tati  ≈ 11 días × 0.5             ≈  5.5
  Érica ≈ 11 días × 0.5             ≈  5.5
                                    ≈ 86 persona-días
× 5 ml por persona-día              ≈ 430 ml por quincena
→ Si quedan 100 ml: necesito 430 + colchón − 100 ≈ 400 ml → comprar 1 frasco de 500 ml
```

**Ejemplo — proteína (carne/pollo/pescado):** 141 porciones × 150 g ≈ **21 kg por quincena**. Si en la realidad compran 15 kg y alcanza, la app se calibra (ver abajo).

### Autocalibración (estadística simple, no IA)

Cada vez que alguien hace un **conteo** ("quedan 4 huevos"), la app compara lo real contra lo que estimaba y ajusta la tasa de consumo de ese producto con un promedio móvil:

```
tasa_nueva = 0.7 × tasa_anterior + 0.3 × tasa_observada
```

Así, en 2–3 quincenas los números se parecen a tu casa real, no a un promedio genérico. Si un producto se descarta (se dañó) seguido, la app sugiere comprar menos o congelar.

### Alertas

- 🔴 **Se acaba antes del próximo mercado** → "Faltan 3 días de leche y el mercado es en 6 días". (Esto es lo que evita compras entre semana: si te enteras al día 3 y no al día 13, puedes ajustar el menú.)
- 🟠 **Se vence pronto** → "El pollo de la nevera vence mañana: cocínalo hoy o congélalo".
- 🟡 **Stock bajo el mínimo**.

---

## 5. Recetas y menú (fase 3)

- **Recetario** con ingredientes por porción (adulto). Cargas las recetas que ya se hacen en la casa.
- **Menú quincenal**: la app propone el menú de 15 días usando:
  - lo que hay en inventario,
  - lo que se vence primero (se usa primero),
  - variedad (no repetir proteína dos días seguidos, etc.),
  - las porciones del día (8, 9 o 10 según quién esté).
- **El menú alimenta la lista de compras**: si el menú tiene lentejas el día 12, la lista incluye las lentejas.
- Al marcar "hoy cociné *Pollo al horno*", se **descuentan los ingredientes solos** — así nadie tiene que registrar uso por uso.

### Menú de Gracia (2 años)

- Plan propio: 3 comidas + 2 meriendas al día, porciones pequeñas.
- Valores de referencia **configurables** (para validar con su pediatra): leche, frutas, verduras, proteína, cereales por día; pañales por día.
- Puede compartir ingredientes con el menú de los adultos (ej. se separa una porción sin sal) y la app descuenta igual.

---

## 6. Aplicaciones parecidas que existen

| App | Qué tiene | Qué le falta para tu caso | Código |
|---|---|---|---|
| **[Grocy](https://grocy.info/)** | Inventario, fechas de vencimiento, stock mínimo, lista de compras, recetas, plan de comidas, código de barras | No calcula consumo según **personas y horarios**; no lee facturas colombianas; está pensado en inglés, para servidor PHP, y es complejo de usar en el celular | Libre (MIT) — [github.com/grocy/grocy](https://github.com/grocy/grocy) |
| **[Mealie](https://github.com/mealie-recipes/mealie)** | Recetas, plan semanal, lista de compras por pasillo, en español | No lleva inventario real ni consumo | Libre (AGPL) |
| **Tandoor Recipes** | Recetas, plan de comidas, nutrición | Sin inventario por consumo; pesado de instalar | Fuente disponible (licencia restringida) |
| **KitchenOwl** | Lista de compras compartida, recetas | Sin inventario por consumo | Libre |
| **Gusteau** | Inventario + recetas, *planea* escaneo de facturas | Proyecto pequeño, casi todo es "por hacer" | [github.com/ROODAY/Gusteau](https://github.com/ROODAY/Gusteau) |
| Apps comerciales (Pantry Buddy, PantryKeep, OurPantry…) | Inventario, algunas con escaneo con IA | Cerradas, en inglés, sin la lógica de tu casa, muchas usan IA | Cerrado |

**Conclusión:** ninguna hace lo central de tu idea — **calcular el consumo con base en quién está en la casa cada día y planear la quincena completa**. Grocy es la más cercana en inventario.

**Recomendación:** construir nuestra propia app (simple, en español, en el celular) y **tomar ideas** de Grocy (cómo modela productos, ubicaciones, vencimientos y stock mínimo) y de Mealie (recetas y lista por pasillo). Copiar el código de Grocy directamente no conviene: es una app grande en PHP, y habría que reescribir justo la parte que a ti más te importa. Si quieres algo funcionando *ya* mientras construimos, se puede instalar Grocy como solución temporal.

---

## 7. Cómo se construye (propuesta técnica)

- **App web instalable en el celular (PWA)**: se abre desde un enlace y se "instala" en la pantalla de inicio, sin tienda de apps. Funciona en Android y iPhone.
- **Datos compartidos en la nube** (ej. Supabase, plan gratuito): así tú, los otros adultos y Rosita ven el mismo inventario desde celulares distintos.
- **Publicación** en Vercel (gratuito para uso personal).
- **Pantallas muy simples** para registrar: botones grandes, "Usé ▸ Huevos ▸ 6", pensando en que Rosita o Tati lo usen en 5 segundos.

### Modelo de datos (resumen)

```
personas        (nombre, tipo, días que está, comidas, factor de consumo)
ausencias       (persona, desde, hasta)            ← viajes, vacaciones, visitas
productos       (nombre, categoría, lugar, unidad, presentación,
                 vida útil, regla de consumo, parámetros, colchón)
lotes           (producto, cantidad, fecha compra, fecha vencimiento, lugar)
movimientos     (producto, tipo: compra/uso/estimado/conteo/descarte, cantidad, fecha, quién)
facturas        (tienda, fecha, archivo, líneas)
equivalencias   (texto en factura → producto, cantidad por unidad)
recetas         (nombre, porciones, ingredientes por porción, para bebé sí/no)
menú            (fecha, comida, receta, porciones)
quincenas       (fecha de mercado, lista generada, lista comprada)
```

---

## 8. Fases

| Fase | Qué incluye | Resultado |
|---|---|---|
| **0. Datos iniciales** | Armar el catálogo con tu lista de mercado actual y 1–2 facturas viejas | Catálogo con ~100–150 productos y sus reglas |
| **1. MVP** | Personas y horarios, catálogo, inventario, compras y usos a mano, consumo estimado, alertas de vencimiento, **lista de compras quincenal** | Ya resuelve "qué compro" y "qué se está dañando" |
| **2. Facturas** | Importar XML de factura electrónica + foto con OCR + diccionario de equivalencias | Cargar el mercado en 2 minutos |
| **3. Recetas y menú** | Recetario, menú de 15 días ordenado por caducidad, descuento automático al cocinar, menú de Gracia | Se planea la quincena completa |
| **4. Mejoras** | Autocalibración, historial, gasto por quincena, qué se bota más | La app se vuelve cada vez más precisa |

---

## 9. Preguntas abiertas (para decidir antes de programar)

1. ¿Quién va a registrar los usos y conteos en el día a día? (¿Rosita tiene celular con internet?)
2. ¿En qué supermercado(s) hacen el mercado? ¿Les llega la factura electrónica al correo?
3. Perecederos que no aguantan 15 días: ¿congelar + ordenar menú, o aceptar una compra mínima de frescos a mitad de quincena?
4. ¿Tienes la lista de mercado actual o fotos/archivos de facturas pasadas para armar el catálogo inicial?
5. ¿Te sirve la propuesta técnica (app web en el celular + Supabase + Vercel, todo gratuito)?
