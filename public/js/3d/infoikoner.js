var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.ORANGE, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Hampus Panorama',
		description: '<p><abbr title="Per Hampus hus">Adress:</abbr> Kungstensgatan 17, 113 57 Nortälje</p><p title="Telefon">Telefon: +46 8 587 503 00</p><body>Denna Panoramabild är gjort med en Dronare Phantom 4 advanced i Nortälje kommun</body><br><br/><iframe width="780" height="430" src="https://3d.sokigo.com/pano/src/standalone/pannellum.htm?panorama=https://3d.sokigo.com/pano/examples/hampus.jpg" frameborder="0" allowfullscreen=""></iframe></iframe>',
        position : Cesium.Cartesian3.fromDegrees(18.85598,60.02060, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});

var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.ORANGE, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Vaxholm Panorama',
		description: '<p><abbr title="Vaxholm hus">Adress:</abbr> Kungstensgatan 17, 113 57 Vaxholm</p><p title="Telefon">Telefon: +46 8 587 503 00</p><body>Denna Panoramabild är gjort med en Dronare Phantom 4 advanced i Nortälje kommun<iframe width="780" height="430" src="https://3d.sokigo.com/pano/src/standalone/pannellum.htm?panorama=https://3d.sokigo.com/pano/examples/vaxholm.jpg" frameborder="0" allowfullscreen></iframe>',
        position : Cesium.Cartesian3.fromDegrees(18.350924,59.405645, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('Assets/Textures/maki/restaurant.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.BLUE, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Restaurang',
        description: '',
        position : Cesium.Cartesian3.fromDegrees(18.0759368919282,59.3459400256879, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('Assets/Textures/maki/restaurant.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.BLUE, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'restaurant',
        description: '',
        position : Cesium.Cartesian3.fromDegrees(18.0715026883737,59.3468223674294, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('Assets/Textures/maki/restaurant.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'restaurant',
        description: 'Best restaurang i Stockholm',        
        position : Cesium.Cartesian3.fromDegrees(18.0676849653805,59.3440957438013, 40),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('Assets/Textures/maki/religious-christian.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.BLACK, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Immanuelskyrkans Församling',
        description: '<p><abbr title="Immanuelskyrkans Församling">Adress:</abbr> Kungstensgatan 17, 113 57 Stockholm</p><p title="Telefon">Telefon: +46 8 587 503 00</p><body>Immanuelskyrkan är en kristen gemenskap, mitt i Stockholm. För människor från hela världen.Vi är en församling, men inbjuder till gudstjänst på flera språk och under många former och traditioner.</body><br><br/><iframe width="100%" height="430px" src="https://drive.google.com/file/d/16z4eJGJe2JpFspBkrL3G-CwAHKoYYV_f/preview" frameborder="0" allowfullscreen></iframe>',        
		position : Cesium.Cartesian3.fromDegrees(18.0675364158476,59.3415506975536, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('Assets/Textures/maki/religious-christian.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.BLACK, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Kyrkogård',
        description: '',        
		position : Cesium.Cartesian3.fromDegrees(18.0630799298633,59.3423233210396, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('Assets/Textures/maki/religious-christian.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.BLACK, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Kyrkogård',
        description: '',
        position : Cesium.Cartesian3.fromDegrees(18.0397279433052,59.3340203556596, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('Assets/Textures/maki/cafe.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.PINK, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Kafe',
		description: '',
        position : Cesium.Cartesian3.fromDegrees(18.0474525190115,59.3383236682889, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('Assets/Textures/maki/cafe.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.PINK, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Kafe',
		description: '',
        position : Cesium.Cartesian3.fromDegrees(18.042461254709,59.3371115593152, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
 
var url = Cesium.buildModuleUrl('Assets/Textures/maki/cafe.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Kafe',
		description: '',
        position : Cesium.Cartesian3.fromDegrees(18.0325975657303,59.3339447205191, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('Assets/Textures/maki/cafe.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Kafe',
        description: '',
        position : Cesium.Cartesian3.fromDegrees(18.0317656883465,59.3325354581069, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
   
var url = Cesium.buildModuleUrl('Assets/Textures/maki/clothing-store.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.YELLOW, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Köping',
        description: '',
        position : Cesium.Cartesian3.fromDegrees(18.0689476364094,59.3230630919891, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.0708193605228,59.3252002884322, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.0745330988431,59.3250357186441, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.0678855072498,59.3243401209174, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.0644985779017,59.3246660019207, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.075714067629,59.322589404371, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.0737643550108,59.3294231298604, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.0772701239852,59.3291010832738, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.08919865147,59.3249805120189, 80),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.0971571926904,59.3246470554363, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.1065678055941,59.3262233668215, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.0916088676399,59.3391721188359, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.1133268093371,59.3471707535633, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});
var url = Cesium.buildModuleUrl('/CesiumIkons/Textures/maki/camera.png');
var groceryPin = Cesium.when(pinBuilder.fromUrl(url, Cesium.Color.GREEN, 35), function(canvas) {
    return cesiumViewer.entities.add({
        name : 'Gamla stan',
        position : Cesium.Cartesian3.fromDegrees(18.1183774934527,59.3437321774427, 60),
        billboard : {
            image : canvas.toDataURL(),
            verticalOrigin : Cesium.VerticalOrigin.BOTTOM
        }
    });
});