const express = require('express')
const router = express.Router()

router.use('/client', require('./client'))
router.use('/admin', require('./admin'))
router.use('/auth', require('./auth'))

module.exports = router
