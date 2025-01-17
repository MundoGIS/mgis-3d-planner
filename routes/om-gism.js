const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Middleware para verificar autenticación
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect('/login');
  }
}

router.use(isAuthenticated);


router.get('/om-gismanager', (req, res) => {
  res.render('info', {
      userRole: req.session.user ? req.session.user.role : null,
      isAuthenticated: !!req.session.user
  });
});



module.exports = router;
