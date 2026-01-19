# Alamos IA - CRM

Sistema de gestión de relaciones con clientes (CRM) personalizado desarrollado con React, TypeScript y Vite.

## Características

El CRM incluye las siguientes secciones:

- **Dashboard**: Vista general con estadísticas y actividad reciente
- **Customers**: Gestión de clientes
- **Calls**: Registro y seguimiento de llamadas
- **Proposals**: Gestión de propuestas comerciales
- **Other Services**: Servicios adicionales
- **Billing**: Facturación y pagos
- **Call Analytics**: Análisis y métricas de llamadas
- **Other Analytics**: Análisis adicionales y métricas

## Tecnologías

- React 18
- TypeScript
- Vite
- React Router DOM
- CSS3 (sin dependencias externas de estilos)

## Instalación

1. Instala las dependencias:
```bash
npm install
```

2. Inicia el servidor de desarrollo:
```bash
npm run dev
```

3. Abre tu navegador en `http://localhost:5173`

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo
- `npm run build`: Construye la aplicación para producción
- `npm run preview`: Previsualiza la build de producción
- `npm run lint`: Ejecuta el linter

## Estructura del Proyecto

```
src/
├── components/
│   ├── Layout.tsx          # Layout principal con navegación
│   └── Layout.css
├── pages/
│   ├── Dashboard.tsx
│   ├── Customers.tsx
│   ├── Calls.tsx
│   ├── Proposals.tsx
│   ├── OtherServices.tsx
│   ├── Billing.tsx
│   ├── CallAnalytics.tsx
│   ├── OtherAnalytics.tsx
│   └── Page.css            # Estilos compartidos para las páginas
├── App.tsx                 # Componente principal con routing
├── main.tsx                # Punto de entrada
└── index.css               # Estilos globales
```

## Próximos Pasos

- [ ] Implementar funcionalidad de CRUD para cada sección
- [ ] Agregar base de datos o sistema de almacenamiento
- [ ] Implementar autenticación de usuarios
- [ ] Agregar gráficos y visualizaciones de datos
- [ ] Implementar búsqueda y filtros
- [ ] Agregar exportación de datos

## Licencia

Este proyecto es de uso privado.
