const express = require('express');
const local = require('passport-local')
var passport = require('passport');
const bcrypt = require('bcrypt');
const cookieparser = require('cookie-parser')
const LocalStrategy = require('passport-local').Strategy
const bodyParser = require('body-parser')
const DBClient = require('./lib/db')
const session = require('express-session');

const path = require('path');
const db = new DBClient("mongodb://localhost:27017/", "panel")
console.log('DB connected')
const app = express()
require('express-ws')(app)
passport.serializeUser(function (user, done) {
    done(null, user._id.toString());
});
passport.deserializeUser(function (id, done) {
    db.fetchUser(id).then(user => {
        delete user.password;
        done(null, user);
    })
});

passport.use('local-login', new LocalStrategy(
    function (username, password, done) {
        db.fetchUserFromEmail(username).then(user => {
            if (!user) {
                console.log('User not found')
                return done('Incorrect username.');
            }
            if (user.password != password) {
                bcrypt.compare(password, user.password, function (err, res) {
                    if (err) {

                        console.log('Error: ' + err.toString());
                        return done(err);
                    }
                    if (res == false) {
                        console.log('Password incorrect');
                        return done('Incorrect password.');
                    } else {
                        return done(null, user);
                    }
                })
            }
        }).catch(err => {
            console.log(err.toString());
            done(err);
        })
    })
);
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: "tHiSiSasEcRetStr",
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next();
    console.log('unauthed')
    res.redirect('/auth/login');
}
function isAdmin(req, res, next) {
    if (req.user.admin == true) return next();
    res.redirect('/client');
}
module.exports.db = db
module.exports.isLoggedIn = isLoggedIn;
module.exports.isAdmin = isAdmin;
module.exports.passport = passport;
app.use('/', require('./routers/index'))
// launch the app
app.listen(3030);
console.log("App running at localhost:3030");
