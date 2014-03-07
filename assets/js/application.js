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
      basemap: "dotted",
      smartNavigation: false
    });

    //add districts
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

      var url = "https://congress.api.sunlightfoundation.com/legislators/locate?latitude=42.96&longitude=-108.09&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

      $.getJSON(url, function(data) {
        $.each(data.results, function(i, rep) {
          console.log('rep', rep);
          $($('.legislator')[ i ]).find('.media-object').attr('src', 'assets/images/'+rep.bioguide_id+'.jpg');
          $($('.legislator')[ i ]).find('.media-heading').html('['+rep.party+'] '+ rep.title + '. ' + rep.first_name + ' ' + rep.last_name);
          $($('.legislator')[ i ]).show();
        });
      });

   });
}

