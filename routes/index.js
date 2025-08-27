const express = require('express');
const router = express.Router();

// รวม router ย่อย
router.use('/', require('./auth'));
router.use('/', require('./client'));
router.use('/', require('./qa'));
router.use('/', require('./news'));
router.use('/', require('./activities'));
router.use('/', require('./complaints'));
router.use('/', require('./contact'));
router.use('/', require('./home'));
router.use('/', require('./status'));
router.use('/', require('./admin'));

module.exports = router;
