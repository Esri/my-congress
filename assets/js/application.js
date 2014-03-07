var App = function(){

  //resize map container
  var height = $(window).height() - 200;
  $('#map').css('height', height+'px');

  this.initMap();
};

App.prototype.initMap = function() {
  var self = this;

  require(["esri/map", "esri/layers/ArcGISTiledMapServiceLayer"], function(Map, ArcGISTiledMapServiceLayer) { 

    // hook up elevation slider events
    esriConfig.defaults.map.basemaps.dotted = {
      baseMapLayers: [
        { url: "http://studio.esri.com/arcgis/rest/services/World/WorldBasemapBlack/MapServer" }
      ],
      title: "Dots"
    };

    self.map = new Map("map", {
      center: [-90.049, 38.485],
      zoom: 4,
      basemap: "dotted"
    });

    //add ditrictus
    var districtsUrl = "http://dcdev.esri.com/arcgis/rest/services/Congress/DistrictsByParty/MapServer";
    var districtsLayer = new ArcGISTiledMapServiceLayer(districtsUrl, {
      opacity: 0.8
    });
    self.map.addLayer(districtsLayer);

    //bind map resize
    $(window).on('resize', function() {
      self.map.resize();
      
      var height = $(window).height() - 200;
      $('#map').css('height', height+'px');

    });

    self._wire();

  });

}

App.prototype._wire = function() {
  var self = this;

  //map events
  this.map.on('click', function(e) {
    self._getDistrict(e);
  });

  this.map.on('hover', function(e) {
    //self._getDistrict(e);
  });

}

App.prototype._getDistrict = function(e) {
  require(["esri/graphic",
    "esri/symbols/PictureMarkerSymbol"],
    //"api/SunlightCongressAPI"],
    function (Graphic, PictureMarkerSymbol) {
       //var congressAPI = new SunlightCongressAPI();

       //console.log('click me', congressAPI)
       /*
       kernel.global.geocodeLayer.clear();
       kernel.global.graphicsLayer.clear();

       var mapPoint;

       if (mouseEvent) {
           mapPoint = mouseEvent.mapPoint;
       } else if (graphic) {
           mapPoint = graphic.geometry.getCentroid();
       }

       kernel.global.enteredLocation = mapPoint;
       kernel.global.enteredZipCode = null;
       kernel.global.geocodeText = mapPoint.getLongitude().toFixed(2) + ", " + mapPoint.getLatitude().toFixed(2);

       congressAPI.getLegislatorsByLocation(mapPoint).then(function (r) {
           //console.log("RESULTS!!!!!: ", r);
           displayLegislatorsByLocation(r.results);
       }, function (e) {
           console.warn("ERROR :", e.message);
       });
      */
   });
}

