# Documentacion Aplicacion - App Gestion Demo

## 1. Resumen general
App Gestion Demo es una aplicacion web para control de proyectos, consultores, horas, gastos, proyecciones y metricas de seguimiento.

La solucion tiene:
- Frontend: React + TypeScript + Vite
- Backend: Fastify + Prisma + PostgreSQL
- Deploy objetivo demo: Vercel (frontend) + Render (backend) + Supabase PostgreSQL

Tambien incluye:
- Modo autenticado con Microsoft (en proceso de estabilizacion)
- Modo demo sin login para presentaciones
- Conversion de moneda con TRM configurable y persistida

---

## 2. Arquitectura actual

### 2.1 Frontend
- Framework: React 19
- Bundler: Vite
- Lenguaje: TypeScript
- Auth UI: MSAL (Microsoft)
- Server de archivos: `frontend/server.mjs`
- Rutas principales de UX:
  - `/login`: ingreso
  - `/home`: aplicacion funcional

### 2.2 Backend
- Framework: Fastify
- ORM: Prisma
- DB: PostgreSQL
- Seguridad:
  - Autenticacion por token Microsoft (cuando esta activa)
  - Autorizacion por roles (ADMIN, PM, CONSULTANT, FINANCE, VIEWER)

---

## 3. Documentacion Frontend

### 3.1 Modulos visibles
La app tiene estas pestañas:
- Dashboard
- Proyectos
- Consultores
- Horas
- Gastos
- Proyecciones
- Usuarios (admin)

### 3.2 Funcionalidades implementadas en frontend

#### Dashboard
- KPIs: presupuesto total, gasto total, horas totales, horas aprobadas
- Filtros:
  - Empresa
  - Proyecto
  - Rango de fechas (desde/hasta)
- Tabla de resumen por proyecto con estado de riesgo:
  - OK
  - Riesgo (>90%)
  - Se pasa (>100%)
- Tabla de horas aprobadas por consultor
- Tabla de proyeccion por consultor

#### Proyectos
- Crear proyecto
- Listar proyectos
- Filtrar por nombre de proyecto o empresa
- Editar proyecto
- Eliminar proyecto
- Moneda como desplegable

#### Consultores
- Crear consultor
- Listar consultores
- Editar consultor
- Eliminar consultor
- Activar / desactivar consultor
- Catalogo de roles como desplegable
- Campo de tarifa por hora

#### Horas
- Crear registro de horas
- Flujo de aprobacion (aprobar / rechazar)
- Visualizacion por estado

#### Gastos
- Crear gasto
- Listar gastos
- Editar gasto
- Eliminar gasto
- Categoria como desplegable
- Moneda como desplegable

#### Proyecciones
- Crear proyecciones
- Soporte de rango de periodo (anio + trimestre inicio y fin)
- Creacion multiple por rango de trimestres
- Listar proyecciones
- Editar proyeccion
- Eliminar proyeccion

#### Usuarios (admin)
- Crear usuario de aplicacion
- Listar usuarios

### 3.3 Conversion de monedas (TRM)
- Configuracion en dashboard:
  - Moneda A
  - Moneda B
  - TRM A -> B
- Visualizacion dual en:
  - Resumen por proyecto
  - Gastos
  - Proyecciones
- Regla:
  - Si el valor esta en Moneda A o Moneda B se convierte
  - Si no coincide, se muestra como no convertible

### 3.4 Persistencia de TRM
- Ya no es solo estado local.
- La configuracion se guarda en backend via API:
  - `GET /api/fx-config`
  - `PUT /api/fx-config`
- Boton disponible en UI: `Guardar TRM`

### 3.5 Modos de autenticacion en frontend

#### Modo normal (Microsoft)
- Requiere configuracion de variables Azure y flujo MSAL.

#### Modo demo
- Permite entrar sin login Microsoft para mostrar funcionalidades.
- Variable:
  - `VITE_FORCE_LOCAL_AUTH=true`

---

## 4. Documentacion Backend

### 4.1 Modelos principales (Prisma)
- Project
- Consultant
- TimeEntry
- Expense
- Forecast
- FxConfig
- User
- Role
- UserRole

### 4.2 Endpoints principales

#### Salud
- `GET /health`

#### Auth
- `GET /api/auth/me`

#### Proyectos
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`

#### Consultores
- `GET /api/consultants`
- `POST /api/consultants`
- `PUT /api/consultants/:id`
- `DELETE /api/consultants/:id`

#### Horas
- `GET /api/time-entries`
- `POST /api/time-entries`
- `PATCH /api/time-entries/:id/approve`
- `PATCH /api/time-entries/:id/reject`
- `DELETE /api/time-entries/:id`

#### Gastos
- `GET /api/expenses`
- `POST /api/expenses`
- `PUT /api/expenses/:id`
- `DELETE /api/expenses/:id`

#### Proyecciones
- `GET /api/forecasts`
- `POST /api/forecasts`
- `PUT /api/forecasts/:id`
- `DELETE /api/forecasts/:id`

#### Estadisticas
- `GET /api/stats/overview`

#### FX Config (TRM persistida)
- `GET /api/fx-config`
- `PUT /api/fx-config`

#### Admin usuarios
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`

### 4.3 Auth y RBAC
- Roles soportados:
  - ADMIN
  - PM
  - CONSULTANT
  - FINANCE
  - VIEWER
- Mensajes de autorizacion mejorados:
  - Usuario no existe
  - Usuario inactivo
  - Usuario sin roles

### 4.4 Modo demo en backend
Para presentacion sin login:
- `AUTH_DEMO_BYPASS=true`
- El backend responde como usuario local admin (segun `ADMIN_EMAIL`).

---

## 5. Variables de entorno clave

### 5.1 Frontend
- `VITE_API_URL`
- `VITE_FORCE_LOCAL_AUTH`
- `VITE_AZURE_TENANT_ID`
- `VITE_AZURE_CLIENT_ID`
- `VITE_AZURE_REDIRECT_URI`
- `VITE_AZURE_API_SCOPE`

### 5.2 Backend
- `DATABASE_URL`
- `DIRECT_URL`
- `CORS_ORIGIN`
- `AUTH_ENABLED`
- `AUTH_DEMO_BYPASS`
- `ADMIN_EMAIL`
- `AZURE_AD_TENANT_ID`
- `AZURE_AD_AUDIENCE`

---

## 6. Funcionalidades actuales (estado)

### 6.1 Ya implementado
- Estructura funcional completa frontend + backend
- CRUD principal en proyectos, consultores, gastos y proyecciones
- Flujo de aprobacion de horas
- Panel de admin usuarios
- Dashboard con filtros y tablas de seguimiento
- TRM y conversion dual visible
- Persistencia de TRM en base de datos
- Modo demo para presentacion sin login

### 6.2 En proceso / parcialmente implementado
- Login Microsoft end-to-end estable en todos los escenarios de deploy
- UX de edicion avanzada (todavia hay ediciones con prompts en algunos casos)

---

## 7. Pendientes

### 7.1 Pendientes funcionales prioritarios
1. Graficas del dashboard
- Barra: presupuesto vs gasto por proyecto
- Linea: tendencia temporal
- Pie/Donut: distribucion de gastos por categoria
- Barra horizontal: horas por consultor

2. CRUD completo de horas
- Editar registro de hora (no solo aprobar/rechazar)
- Filtros por estado/fecha/proyecto/consultor en modulo de horas

3. Filtros avanzados por modulo
- Gastos por categoria y rango
- Proyecciones por consultor, periodo y proyecto

4. Mejorar UX de edicion
- Reemplazar `window.prompt` por modales/formularios consistentes

### 7.2 Pendientes tecnicos
1. Endurecer flujo productivo Microsoft
- Redireccion, scopes y audience estables

2. Pruebas
- E2E de flujo principal
- Pruebas de regresion para CRUD y dashboard

3. Hardening final
- Manejo de errores uniforme
- Telemetria/logs funcionales para soporte de produccion

---

## 8. Flujo sugerido para demo
1. Activar modo demo:
- Frontend: `VITE_FORCE_LOCAL_AUTH=true`
- Backend: `AUTH_DEMO_BYPASS=true`

2. Ingresar a:
- `https://<frontend>/home`

3. Mostrar:
- Dashboard con filtros y conversion dual
- CRUD de modulos principales
- Panel de usuarios

---

## 9. Referencias internas
- Guia visual: `contexto/SY_6.html`
- Frontend README: `frontend/README.md`
- Backend README: `backend/README.md`
