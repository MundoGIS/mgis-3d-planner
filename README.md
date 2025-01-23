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

MGIS-3D-Planner is a Geographic Information System (GIS) tool designed for the visualization and management of spatial data in 3D. It enables engineers and decision-makers to effectively create scenes that provide a clearer understanding of how a future urban area might appear. Beyond urban projects, it also adapts to the visualization of wind and solar parks, as well as other types of areas. 
GITHUB

# Key features of MGIS-3D-Planner include:

# Backend:

1- User registration and creation system.
2- Capability to upload and store spatial data in formats such as JPEG, PNG, CZML, GLTF, 3D-Tiles, KML, KMZ, and terrains in Quantized-Mesh. Additionally, it allows adding terrains from the Cesium Ion platform.
3- Ability to position GLTF models on the terrain.
4- Functionality to serve GLTF models and images as links that can be used externally.

# Frontend: 

The frontend displays a Cesium map with a wide range of functions, enabling users to perform various operations according to their objectives. Some of the functions include:

1- Tools for measuring distance and area.
2- Option to add the Cesium Ion token to access terrains in Cesium Ion.
3- Widgets to manage 3D layers, background, and terrains.
4- Map printing tool with various format adjustment options.
5- Tools for drawing lines, polygons, circles, 3D objects, and adding temporary GLTF models. The GLTF models must be previously uploaded to the backend to be available on the 3D map of the frontend.
6- Ability to add clouds anywhere on the map, adjustable in color, height, shape, and size.
7- Option to enable and disable shadows, as well as show and hide the Cesium clock and timeline.
8- In addition to adding all local data uploaded by the administrator in the backend, the frontend also allows adding terrains from Cesium Ion and background layers from different sources.


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
