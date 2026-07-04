const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./src/config/env');
const routes = require('./src/routes');
const { notFound, errorHandler } = require('./src/middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Comandia', version: '1.0.0' });
});

app.use('/api', routes);

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

app.listen(env.port, () => {
  console.log(`Comandia backend corriendo en http://localhost:${env.port}`);
});
