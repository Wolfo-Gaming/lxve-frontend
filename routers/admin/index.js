const express = require('express')
const { isLoggedIn, isAdmin } = require('../..')
const router = express.Router()

router.use(isLoggedIn)
router.use(isAdmin)

module.exports = router