const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./src/config/env');
const routes = require('./src/routes');
const { notFound, errorHandler } = require('./src/middlewares/errorHandler');
const { aplicarEsquema } = require('./src/config/initDB');

const app = express();

// script-src necesita 'wasm-unsafe-eval' para que el frontend pueda
// instanciar el WebAssembly de sql.js (modo offline); sin esto el CSP por
// defecto de helmet bloquea la compilación del módulo en producción.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'wasm-unsafe-eval'"],
      },
    },
  })
);
app.use(cors());
app.use(express.json({ limit: '8mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Comandia', version: '1.0.0' });
});

app.use('/api', routes);

app.use('/uploads/productos', express.static(env.uploadsDir));
app.use('/uploads/restaurantes', express.static(path.join(env.uploadsDir, 'restaurantes')));

// Servir frontend compilado en producción
if (env.nodeEnv === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));

  // Todas las rutas no-API sirven index.html (React Router)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

// Aplica migraciones pendientes (ALTER TABLE ... IF NOT EXISTS, etc.) antes
// de aceptar tráfico, para que un cambio de esquema nunca quede desfasado
// entre lo que despliega Railway y lo que corre "npm run db:init" a mano.
aplicarEsquema()
  .then(() => {
    app.listen(env.port, '0.0.0.0', () => {
      console.log(`Comandia backend corriendo en http://localhost:${env.port}`);
    });
  })
  .catch((err) => {
    console.error('Error aplicando el esquema de base de datos:', err.message || err);
    process.exit(1);
  });
