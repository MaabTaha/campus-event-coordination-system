var passport = require('passport');
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var User = require('./Users');

var opts = {};
// opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("JWT");
// opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("jwt");
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();

opts.secretOrKey = process.env.SECRET_KEY;

passport.use(new JwtStrategy(opts, function(jwt_payload, done) {
    // console.log("AUTH HEADER:", req.headers); 
    User.findById(jwt_payload.id, function (err, user) {
        if (user) {
            done(null, user);
        } else {
            done(null, false);
        }
    });
}));

exports.isAuthenticated = passport.authenticate('jwt', { session : false });
exports.secret = opts.secretOrKey ;