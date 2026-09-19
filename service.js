
/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const path = require('path');
const Service = require('node-windows').Service;

// Crea un nuevo objeto de servicio
const svc = new Service({
  name: 'MundoGIS-3D',
  description: 'MundoGIS 3D planner',
  script: path.join(__dirname, 'app.js'),
  workingDirectory: __dirname,
  nodeOptions: [
    '--max-old-space-size=8192'
  ]
});

// Define eventos para el servicio
svc.on('install', function() {
  svc.start();
});

// Instala el servicio
svc.install();

