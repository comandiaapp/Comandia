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

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Comandia backend corriendo en http://localhost:${env.port}`);
});
