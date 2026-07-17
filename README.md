This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 🚀 Características Principales (Features)

El sistema de Seguimiento de Órdenes de Trabajo (OT) está diseñado bajo una arquitectura **SaaS Multi-tenant**, lo que permite rentabilizar el software ofreciéndolo a múltiples organizaciones de forma independiente, centralizada y segura.

### 💼 Características de Negocio (Enfoque Comercial)
*   **Modelo SaaS Multi-inquilino (Multi-tenant):** Permite a múltiples empresas (clientes comerciales) usar la misma plataforma de forma totalmente aislada. Cada empresa administra de forma independiente sus propios técnicos, operadores, clientes y configuraciones de servicio, garantizando la privacidad absoluta de su operación.
*   **Gestión Integral del Ciclo de Vida de las OTs:** Herramienta ágil para registrar, dar seguimiento y controlar el flujo de trabajo de cada orden de trabajo. Permite asignar personal técnico, definir prioridades y monitorear el progreso de las tareas para asegurar el cumplimiento de los tiempos de entrega y mejorar la satisfacción del cliente final.
*   **Ingesta y Mapeo Inteligente de Incidencias:** Automatiza la recepción de órdenes desde plataformas o sistemas externos (ej. scraping de alertas) mediante el uso de API Keys exclusivas para cada empresa. El sistema traduce automáticamente las prioridades externas a niveles de atención internos según los acuerdos de nivel de servicio (SLA) configurados para cada cliente.
*   **Portal de Clientes y Gestión Tributaria:** Control organizado de la cartera de clientes de cada inquilino, facilitando la identificación única de cada cliente mediante su número tributario (RUC) para una facturación y asignación de servicios precisas.
*   **Dashboard de Control y Análisis Operativo:** Panel visual interactivo que consolida estadísticas clave, como el conteo de órdenes activas, pendientes, en progreso y completadas, facilitando la toma de decisiones gerenciales basadas en datos de productividad en tiempo real.
*   **Consola de Superadministrador (Administración Global):** Panel exclusivo para los creadores del SaaS que permite controlar el alta, baja, facturación y monitoreo de todas las empresas afiliadas a la plataforma.

### 🛠️ Características Técnicas
*   **Aislamiento Estricto a Nivel de Base de Datos:** Backend robusto desarrollado en **FastAPI** y **SQLAlchemy** con filtros de consulta a nivel de inquilino para prevenir cualquier fuga o acceso indebido de información entre tenants.
*   **Seguridad y Roles (RBAC):** Autenticación y autorización moderna mediante **JSON Web Tokens (JWT)** y contraseñas encriptadas con **bcrypt**, dividiendo los accesos en perfiles diferenciados: Superadmin, Admin, Operador, Técnico y Cliente.
*   **Procesamiento Asíncrono en Segundo Plano:** Uso de **Celery** con **Redis** como broker para manejar tareas pesadas de forma asíncrona (como el envío automático de notificaciones a técnicos y clientes) sin afectar la velocidad de respuesta de la interfaz de usuario.
*   **Arquitectura Reactiva y Moderna:** Frontend desarrollado sobre **Next.js 14+** con enrutamiento de carpetas (`App Router`), layouts dinámicos y estilizado con CSS moderno y responsivo para una experiencia fluida en dispositivos móviles y de escritorio.
*   **Entorno Contenedorizado y Escalable:** Despliegue optimizado mediante **Docker** y **Docker Compose** que asegura la replicabilidad exacta del entorno local en servidores de staging y producción.

---

## 🗺️ Extensiones Planificadas: Módulo de Ejecución en Campo (Técnico) y Soporte de Oficina

Para competir con soluciones de nivel empresarial de gestión de campo (field service), el sistema se extenderá con un módulo mobile-first enfocado en el técnico y una consola web de soporte para el asistente de oficina.

### 📱 1. Vista Técnico de Campo (Mobile-First)
Bajo el principio de **"menos es más"**, reduciendo tiempos de interacción y clicks en ambientes de trabajo exigentes:
*   **Bandeja de OTs Priorizada:** Listado de órdenes ordenado por severidad y tiempo de SLA restante con códigos de color de advertencia.
*   **Acciones Express en 1-Tap:** Botón único para registrar estados ("Aceptar", "En Camino", "Llegué al Sitio", "Iniciar") que registra automáticamente la hora exacta y las coordenadas de geolocalización.
*   **Checklist Dinámico por Tipo de Servicio:** Carga automática de plantillas de control (ej. mantenimiento de aire acondicionado, generadores) con botones grandes Sí/No, escalas y teclado numérico directo. Guardado parcial integrado.
*   **Registro Agil de Repuestos:** Selección visual desde catálogo específico con controles de cantidad `+/-` (steppers) para evitar digitación manual.
*   **Cierre de OT con Firma y Evidencia:** Captura de firma táctil y fotografías obligatorias/opcionales. Validación automática estricta que impide cerrar órdenes si hay ítems obligatorios vacíos.
*   **Modo Offline Avanzado:** Almacenamiento local de avances en SQLite/LocalStorage con sincronización automática en segundo plano al recuperar conexión, indicando visualmente el estado de sincronización.
*   **Notificaciones Push:** Avisos instantáneos al técnico sobre nuevas asignaciones, reasignaciones y alertas de SLA próximo a vencer.

### 🏢 2. Vista Asistente de Oficina (Seguimiento y Soporte)
Consola de monitoreo en tiempo real para optimizar la toma de decisiones administrativas:
*   **Panel de Monitoreo de Campo:** Mapa y estados de actividad de técnicos, tiempos de traslado y orden en ejecución en tiempo real.
*   **Reasignaciones en Caliente:** Capacidad de reasignar tareas entre técnicos inmediatamente con alertas automáticas.
*   **Alertas por Estancamiento:** Avisos visuales sobre OTs detenidas en un estado por más tiempo del estipulado.
*   **Chat Interno por OT:** Comunicación bidireccional técnico-oficina dentro de la misma orden para evitar el uso de WhatsApp personal.
*   **Control y Aprobación de Cierre:** Visualización y revisión exhaustiva de las evidencias fotográficas, checklists y firmas antes de archivar/facturar.
*   **Reportes de Productividad:** Exportación en PDF/Excel por técnico, cliente, tipo de trabajo y rango de tiempo.

### ⚙️ 3. Administración de Plantillas de Trabajo (Backoffice)
Herramienta de diseño de procesos de campo para administradores de cada empresa (SaaS Tenant):
*   **Creador de Checklists:** Configuración de campos obligatorios, orden de preguntas, tipos de respuesta y requerimiento de foto.
*   **Catálogo Vinculado:** Asociación de repuestos y materiales permitidos por tipo de servicio.
*   **Tiempos Referenciales:** Configuración de duración estimada de ejecución para el cálculo inteligente del SLA.
*   **Clonación de Procesos:** Duplicado rápido de plantillas para generar variantes ágilmente.

### 🔄 4. Puntos de Integración
*   **Modelo Multi-tenant:** Aislamiento total de plantillas, repuestos, técnicos e información de campo entre empresas.
*   **Ingesta Inteligente:** Vinculación del tipo de trabajo determinado por el scraping/API Key externa con la plantilla correspondiente de manera automática.
*   **KPIs en el Dashboard Principal:** Nuevas métricas consolidadas (tiempo medio de traslado, tasa de resolución al primer contacto, técnico más rápido, OTs completadas con checklist).

### 🧪 5. Plan de Pruebas Requerido
*   **Pruebas Unitarias de Cierre:** Validación de reglas de bloqueo para evitar firmas y cierres en plantillas incompletas.
*   **Pruebas de Sincronización Offline:** Simulación de pérdida de red a mitad del llenado de checklists y aserción de consistencia de datos post-recuperación.
*   **Pruebas de Aislamiento Multi-tenant:** Intentos de acceso cruzado a plantillas, catálogos o estados de técnicos entre distintas empresas.
*   **Flujo End-to-End:** Ingesta automática por API Key -> Asignación automática -> Ejecución y Checklists en Campo -> Cierre con firma -> Aprobación administrativa en oficina.
*   **Pruebas de Carga en Bandeja:** Evaluación de respuesta del listado del técnico con alto volumen de órdenes activas concurrentes.

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
