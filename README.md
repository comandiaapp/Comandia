# Comandia

Sistema POS (punto de venta) SaaS para restaurantes, local-first: funciona offline con SQLite local y sincroniza con PostgreSQL en Railway cuando hay internet.

## Stack

- **Backend**: Node.js + Express + PostgreSQL (Railway)
- **Frontend**: React + Vite (por ahora web, a futuro Tauri para desktop)
- **Autenticación**: JWT + bcryptjs, multi-tenant por restaurante
- **Modo offline**: SQLite local con sincronización

## Estructura

- `backend/` — API REST: rutas, controladores, middlewares, modelos y configuración de base de datos
- `frontend/` — App web: componentes, páginas, hooks, contextos y base de datos local (SQLite)

## Variables de entorno

Cada carpeta (`backend/` y `frontend/`) tiene un archivo `.env.example`. Antes de correr el proyecto, copia ese archivo a `.env` y llena los valores correspondientes:

```bash
cd backend
cp .env.example .env

cd ../frontend
cp .env.example .env
```

Los archivos `.env` nunca se suben al repositorio.

## Comandos

Desde `backend/`:

```bash
npm run dev       # levanta el servidor de desarrollo
npm run db:init   # crea las tablas en la base de datos (lee schema.sql)
```

Desde `frontend/`:

```bash
npm run dev       # levanta el servidor de desarrollo de Vite
```
