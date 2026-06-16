const express = require('express');
const router = express.Router();
const requireJwt = require('../../middlewares/requireJwt');

router.use(requireJwt);

router.get('/', (req, res) => {
  res.json({ message: 'Get reports placeholder' });
});

module.exports = router;
