const express = require(`express`);
const session = require(`express-session`);
const CiscoSparkStrategy = require(`../../..`).Strategy;
const passport = require(`passport`);
const errorhandler = require(`errorhandler`);
const {base64} = require(`@ciscospark/common`);

// eslint-disable-next-line new-cap
const router = express.Router();

let userDB;

passport.serializeUser((user, done) => {
  userDB = user;
  done(null, `id`);
});

passport.deserializeUser((id, done) => {
  done(null, userDB);
});

// All options should be straight out of environment variables
passport.use(new CiscoSparkStrategy({}, (accessToken, refreshToken, profile, done) => {
  done(null, profile);
}));

router.use(session({secret: `keyboard cat`}));
router.use(passport.initialize());
router.use(passport.session());

router.get(`/auth/ciscospark`, passport.authenticate(`ciscospark`));
router.get(`/`, passport.authenticate(`ciscospark`, {failureRedirect: `/login`}), (req, res) => {
  // Successful authentication, respond with enough info to write an assertion.
  res.send({id: base64.decode(req.user.id)}).end();
});

router.use(errorhandler());

module.exports = router;
