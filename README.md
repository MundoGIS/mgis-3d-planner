# MGIS 3D-Planner

**Open Source Version of MGIS 3D-Planner**

## About the Company

This software was developed by **MundoGIS**, a company specializing in GIS solutions and 3D data visualization.

- **Website:** [https://mundogis.eu](https://mundogis.eu)
- **Contact email:** abel.gonzalez@mundogis.eu

## License
This project is licensed under the [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/).

## Disclaimer
The open source version of MGIS 3D-Planner provides basic functionality. For advanced features, including additional tools and premium support, consider [MGIS 3D-Planner Plus](https://mundogis.eu/3dplannerplus).

## Overview
MGIS 3D-Planner is a powerful platform for rural and urban design, development, and real estate planning. Built with Cesium JS technology, it enables users to design and visualize projects while understanding their real-time impact. 

In addition to urban planning, MGIS 3D-Planner can be used to plan and visualize wind and solar parks, as well as other types of land-based projects.

MGIS 3D-Planner is built with **Node.js**, **Express**, and **CesiumJS**.

## Installation
To install MGIS 3D-Planner, follow these steps:

1. Install **Node.js** on your server or system where MGIS 3D-Planner will run.
2. Clone the repository or download the source code.
3. Navigate to the project directory and install dependencies by running:
   ```bash
   npm install
4. Open the .env file and assign appropriate values to each variable:

SESSION_SECRET=your_session_secret_here
JWT_SECRET=your_jwt_secret_here

5. Update the default admin user credentials in app.js. The default credentials are:
Username: admin
Password: admin

## Recommended: Create a Cesium Ion Account
It is strongly recommended to create a free account on Cesium Ion to access high-quality terrain datasets, imagery layers, and 3D Tiles.

## Benefits of Cesium Ion Integration:
Access global terrain datasets for realistic visualizations.
To use Cesium Ion, generate a token from your account and update the configuration in app.js with your token. Without this step, MGIS 3D-Planner will run with limited terrain functionality.

## Running as a Service (Windows)
To run MGIS 3D-Planner as a service on Windows:

Open Command Prompt as Administrator.
Navigate to the directory where MGIS 3D-Planner is installed.
Install it as a Windows service by running:

node .\service.js
