const controller = require('./controllers/superAdmin/statistique.controller');

const res = {
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; console.log(JSON.stringify(payload, null, 2)); return this; }
};

controller.getStatistiques({ user: { role: 'SUPER_ADMIN' } }, res)
  .then(() => {})
  .catch((err) => console.error(err));
