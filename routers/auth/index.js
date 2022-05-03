const express = require('express')
const router = express.Router()
const { passport } = require('../../')


router.get("/login", function (req, res) {
 res.render('auth/login')
});
router.post("/login", passport.authenticate("local-login", { failureRedirect: "/auth/login" }), function (req, res) {
    res.redirect("/client");
});
router.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/auth/login");
});

module.exports = router