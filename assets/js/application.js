var App = function(){

  //resize map container based on window size
  var height = $(window).height() - 200;
  var width = $(window).width();
  $('#map').css('height', height+'px');
  $('#congress-seal').css('margin-left', (width / 2) - 25 + 'px');

  //global loader across top of page
  $( document ).ajaxStart(function() {
    NProgress.start();
  });

  $( document ).ajaxStop(function() {
    NProgress.done();
  });

  this._mapStyle = "default";

  //right off the bat kick off calls to Sunlight for data
  this._getAllCommittees();
  this._getAllLegNames();

  //init map
  this.initMap();

};


/*
* Setup map
* Custom basemap
* FeatureLayers with U.S. congressional districts
*/
App.prototype.initMap = function() {
  var self = this;

  require(["esri/map", "esri/layers/ArcGISTiledMapServiceLayer", 
    "esri/layers/FeatureLayer"], 
    function(Map, ArcGISTiledMapServiceLayer, FeatureLayer) { 

    //custom basemap
    esriConfig.defaults.map.basemaps.dotted = {
      baseMapLayers: [
        { url: "http://studio.esri.com/arcgis/rest/services/World/WorldBasemapBlack/MapServer" }
      ],
      title: "Dots"
    };

    self.map = new Map("map", {
      center: [-92.049, 41.485],
      zoom: 4,
      basemap: "dotted",
      smartNavigation: false
    });
      self.map.on('load', function(){
      self.map.disableScrollWheelZoom();
    });

    self.placeNames = new FeatureLayer("http://studio.esri.com/arcgis/rest/services/World/WorldLabelsWhite/MapServer/2", {
      mode: esri.layers.FeatureLayer.MODE_SNAPSHOT,
      outFields: ["CITY_NAME"]
    });

    self.featureLayerGen = new FeatureLayer("http://services1.arcgis.com/o90r8yeUBWgKSezU/arcgis/rest/services/Congressional_Districts_outlines/FeatureServer/2",{
      outFields: ["*"]
    });

    self.featureLayer = new FeatureLayer("http://services1.arcgis.com/o90r8yeUBWgKSezU/arcgis/rest/services/Congressional_Districts_outlines/FeatureServer/1",{
      mode: esri.layers.FeatureLayer.MODE_SNAPSHOT,
      outFields: ["*"]
    });

    self.states = new FeatureLayer("http://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_States_Generalized/FeatureServer/0", {
      mode: esri.layers.FeatureLayer.MODE_SNAPSHOT,
      outFields: ["STATE_ABBR"],
      opacity:0
    })

    self.map.addLayer(self.states);
    self.map.addLayer(self.featureLayerGen);
    self.map.addLayer(self.featureLayer);
    self.map.addLayer(self.placeNames);

    self.featureLayerGen.on('update-end', function(obj) {
      var style = self._getMapStyle();
      
      if ( style === "default" ) {
        self._defaultStyle();
      } else {
        self._styleByCommitteeCount();
      }

    });

    self.featureLayer.on('update-end', function(obj) {
      var style = self._getMapStyle();
      
      if ( style === "default" ) {
        self._defaultStyle();
      } else {
        self._styleByCommitteeCount();
      }
    });
    
    self._wire();

  });

}

App.prototype._getLocation = function() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(this._showPosition);
  }
}

App.prototype._showPosition = function(position) {
  app._getLegByLatLong( position.coords );
}

/*
* Wire events within map
* Setup search and typeahead
*/ 
App.prototype._wire = function() {
  var self = this;

  //bind map resize
  $(window).on('resize', function() {
    self.map.resize();
    
    var height = $(window).height() - 200;
    var width = $(window).width();
    
    $('#map').css('height', height+'px');
    $('#congress-seal').css('margin-left', (width / 2) - 25 + 'px');

  });

  //location
  $('#location-btn').on('click', function(e) {
    $(this).toggleClass('btn-primary');
    if ( $(this).hasClass('btn-primary') ) {
      self._getLocation();
    }
  });

  //map events
  this.map.on('click', function(e) {
    self._getLegByLatLong(e);
  });

  self.featureLayer.on('mouse-over', function(e) {
    self._featureSelected( e.graphic, 'mouse-over' );
    self._showHoverWindow(e);
  });

  self.featureLayer.on('mouse-out', function(e) {
    self._removeSelectedFeature( 'mouse-over' );
    $('#hoverinfo').hide();
  });

  //layer EVENTS
  self.featureLayer.on('click', function(e) {
    self._featureSelected( e.graphic, 'click' );
  });

  //typeahead search
  $('#search-reps').on('typeahead:selected', function(e,data) {
    self._getLegByName(data.value);
  });

  //zipcode search
  $('#search-reps').on('keydown', function(e) {
    if ( e.keyCode === 13 ) {
      self._getLegByZipcode($(this).val());
    }
  });

  //bind legislator name click for GET committees
  $('.legislator').on('click', function(e) {
    var name = $(this).find('.media-heading').html();
    
    $('.legislator-inner').removeClass('selected');
    $(this).find('.legislator-inner').addClass('selected');

    self._showMemberDetails(name);
    self._showCommittees(name.split('.')[1]);
  });

  //LEGEND
  $('#style-by-count').on('change', function() {
    var checked = $(this).is(':checked');
    if ( checked ) {

      self._mapStyle = "byCommitteeSize";
      self._styleByCommitteeCount();
      $('#by-count-container').show();

    } else {
      
      self._mapStyle = "default"
      self._defaultStyle();
      $('#by-count-container').hide();

    }
  });

}


/* returns how map is currently styled */
App.prototype._getMapStyle = function() {
  return this._mapStyle;
}

/*
* Set Map Extent
*
*/
App.prototype._setMapExtent = function() {
  var extent = this.selectedGraphic.geometry.getExtent();
  this.map.setExtent(extent.expand(5));
}



/*
* On polygon click, show as SELECTED on map
*
*/
App.prototype._featureSelected = function(graphicJson, type) {

  if (!graphicJson) return;

  //remove previously selected graphic 
  this._removeSelectedFeature(type);

  //set selected graphic on the app
  if ( type === "click" ) {
    this._removeSelectedState();
    this.selectedGraphic = graphicJson;
    this._setMapExtent();
  }

  //add selected graphic
  var id = ( type === "mouse-over" ) ? "hoverGraphic" : "selectedGraphic";
  
  var graphic = {};
  graphic.geometry = graphicJson.geometry;
  graphic.symbol = {};
  graphic.attributes = { id: id }


  graphic.symbol = {
    "color":[255,255,255,64],"outline":{"color":[255,255,255,255],
    "width":0.8,"type":"esriSLS","style":"esriSLSSolid"},
    "type":"esriSFS","style":"esriSFSSolid"
  };


  var g = new esri.Graphic( graphic );
  
  //add to map
  this.map.graphics.add( g );
}



/*
* Pass a district (#) AND state to select on map
* 
*
*/
App.prototype._selectDistrict = function(district, state) {
  var self = this;
  var g;
  $.each(this.featureLayer.graphics, function(i, graphic) {
    if ( parseInt(graphic.attributes.CD113FIPS) === district && graphic.attributes.STATE_ABBR === state ) {
      g = graphic;
    }
  });
  this._featureSelected(g, 'click');
}


/*
*
*
*
*/
App.prototype._selectState = function(state) {
  var self = this;

  $.each(this.states.graphics, function(i, s) {
    if ( s.attributes.STATE_ABBR === state ) {

      self._removeSelectedFeature('mouse-over');
      self._removeSelectedFeature();
      self._removeSelectedState();
      self.selectedGraphic = s;
      self._setMapExtent();

      var graphic = {};
      graphic.geometry = s.geometry;
      graphic.symbol = {};
      graphic.attributes = { id: "stateSelected" }

      graphic.symbol = {
        "color":[255,255,255,64],"outline":{"color":[255,255,255,255],
        "width":0.8,"type":"esriSLS","style":"esriSLSSolid"},
        "type":"esriSFS","style":"esriSFSSolid"
      };


      var g = new esri.Graphic( graphic );
      
      //add to map
      self.map.graphics.add( g );
    }
  });

}


/*
* Remove selected polygon
*
*/
App.prototype._removeSelectedFeature = function(type) {
  var self = this;

  //do not remove selected state polygon on hover events!
  if ( type === "mouse-over" ) {
    $.each(this.map.graphics.graphics, function(index,gra){
      if (gra) {
        if(gra.attributes && gra.attributes.id === "hoverGraphic"){
          self.map.graphics.remove( gra );
        }
      }
    });
  } else {
    $.each(this.map.graphics.graphics, function(index,gra){
      if (gra) {
        if(gra.attributes && gra.attributes.id === "selectedGraphic"){
          self.map.graphics.remove( gra );
        }
      }
    });
  }

}


App.prototype._removeSelectedState = function() {
  var self = this;

  $.each(this.map.graphics.graphics, function(index,gra){
    if (gra) {
      if(gra.attributes && gra.attributes.id === "stateSelected"){
        self.map.graphics.remove( gra );
      }
    }
  });

}



/*
* Populate infowindow with attributes from FeatureLayer
* 
*/
App.prototype._showHoverWindow = function(e) {
  var self = this;
  $('#hoverinfo').show().css({left:e.clientX+10+'px', top:e.clientY+10+'px'});

  var html = '<div>['+e.graphic.attributes.PARTY.charAt(0)+'] '+e.graphic.attributes.NAME+'</div>\
    <div>State: '+e.graphic.attributes.STATE_ABBR+'</div>\
    <div>District: '+e.graphic.attributes.CD113FIPS+'<div>'

  $('#hoverinfo').html( html );
}




/*
* Get ALL member names, store as app.legislators for search typeahead
* Get ALL legislators, store as app.allLegislators for feature use
*
*/ 
App.prototype._getAllLegNames = function() {
  var self = this;
  var url = "https://congress.api.sunlightfoundation.com/legislators?per_page=all&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  //store on app
  this.legislators = [];
  this.allLegislators = [];

  //sunlight api lookup
  $.getJSON(url, function(data) {
    //console.log(data);
    //save array of all leg for later use
    self.allLegislators = data.results;

    //save just names for 'typeahead'
    $.each(data.results, function(i, rep) {
      self.legislators.push(rep.first_name + ' ' + rep.last_name);
    });

    //wire typeahead with new legislators array
    $('#search-reps').typeahead({
      name: "reps",
      local: self.legislators
    });

  });

}



/*
* Get ALL committees
*
*/ 
App.prototype._getAllCommittees = function() {
  var self = this;
  var url = "https://congress.api.sunlightfoundation.com/committees?per_page=all&fields=members,name&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";
  $.getJSON(url, function(data) {
    self.allCommittees = data;
  });
}





/*
* To style map based on number of committees rep is a member of, calculate this
*
*/
App.prototype._buildStyler = function() {
  var self = this; 

  if ( this.allLegislators.length <= 0 || this.allCommittees === undefined || this.memberCommitteeCount !== undefined ) return;

  this.memberCommitteeCount = {};
  $.each(self.legislators, function(i, name) {
    self.memberCommitteeCount[ name ] = 0;
  });

  $.each(self.allCommittees.results, function(i, comm) {
    for (var mem in comm.members ) {

      var n = comm.members[ mem ].legislator.first_name + ' ' + comm.members[ mem ].legislator.last_name;
      self.memberCommitteeCount[ n ]++;

    }
  });

  if ( !self._mapStyled === "default" ) this._defaultStyle();

}




/*
* Default style for map | Blue and Red
* 
*
*/
App.prototype._defaultStyle = function() {
  var self = this;

  require(["esri/renderers/SimpleRenderer", "esri/layers/LabelLayer", "esri/symbols/TextSymbol",
    "esri/renderers/ClassBreaksRenderer", "esri/symbols/SimpleFillSymbol",
    "dojo/_base/Color", "dojo/dom-style", "esri/renderers/UniqueValueRenderer", "esri/symbols/SimpleLineSymbol"], 
    function(SimpleRenderer, LabelLayer, TextSymbol, ClassBreaksRenderer, SimpleFillSymbol, Color, domStyle, UniqueValueRenderer, SimpleLineSymbol) { 
    

    var defaultSymbol = new SimpleFillSymbol();
        defaultSymbol.outline.setStyle(SimpleLineSymbol.STYLE_DASH, new Color([255,255,255,255]), 3);

      var renderer = new UniqueValueRenderer(defaultSymbol, "PARTY");
      renderer.addValue("Democrat", new SimpleFillSymbol().setColor(new Color([49,130,189, 0.7])));
      renderer.addValue("Republican", new SimpleFillSymbol().setColor(new Color([222,45,38, 0.7])));
      renderer.addValue("Vacant", new SimpleFillSymbol().setColor(new Color([222,45,38, 0.7])));

      var json = renderer.toJson();
      $.each(json.uniqueValueInfos, function(i,sys) {
        sys.symbol.outline = {
          color: [225,225,225,255],
          style:"esriSLSSolid",
          width:0.3,
          type:"esriSLS"
        }
      });

      var rend = new UniqueValueRenderer(json);

      self.featureLayerGen.setRenderer( rend );
      self.featureLayerGen.redraw();

      self.featureLayer.setRenderer( rend );
      self.featureLayer.redraw();


      //TEXT 
      var labelField = "CITY_NAME";

      // create a renderer for the states layer to override default symbology
      var namesColor = new Color("#FFF");
      
      // create a text symbol to define the style of labels
      var namesLabel = new TextSymbol().setColor( namesColor );
      namesLabel.font.setSize( "10pt" );
      namesLabel.font.setFamily( "arial" );
      namesLabel.x = 10;
      namesLabelRenderer = new SimpleRenderer( namesLabel );
      var labels = new LabelLayer( { id: "labels" } );
      
      labels.addFeatureLayer(self.placeNames, namesLabelRenderer, "${" + labelField + "}");
      
      // add the label layer to the map
      self.map.addLayer(labels);
  });

}




/*
* Classbreaks styling of main feature layer
* INSANE 
*
*/
App.prototype._styleByCommitteeCount = function() {
  var self = this;
  
  this._buildStyler();

  if ( !this.memberCommitteeCount || this.featureLayer.graphics.length <= 5 ) return; 
  
  require(["esri/renderers/SimpleRenderer",
    "esri/renderers/ClassBreaksRenderer", "esri/symbols/SimpleFillSymbol",
    "dojo/_base/Color", "dojo/dom-style", "esri/renderers/UniqueValueRenderer", "esri/symbols/SimpleLineSymbol"], 
    function(SimpleRenderer, ClassBreaksRenderer, SimpleFillSymbol, Color, domStyle, UniqueValueRenderer, SimpleLineSymbol) { 

    //console.log('grpahics', app.featureLayer.graphics.length);  
    var layers = [self.featureLayer, self.featureLayerGen];
    
    $.each(layers, function(i,layer) {
      $.each(layer.graphics, function(i, graphic) {
        if ( graphic.attributes.PARTY === "Republican" ) {

          var name = graphic.attributes.NAME.split(' ')[0] + ' ' +graphic.attributes.LAST_NAME;
          
          if ( self.memberCommitteeCount[ name ] <= 1 ) {
            graphic.attributes[ "schema" ] = "r0";
          } else if ( self.memberCommitteeCount[ name ] > 1 && self.memberCommitteeCount[ name ] < 5 ) {
            graphic.attributes[ "schema" ] = "r1";
          } else if ( self.memberCommitteeCount[ name ] >= 5 && self.memberCommitteeCount[ name ] < 9 ) {
            graphic.attributes[ "schema" ] = "r2";
          } else {
            graphic.attributes[ "schema" ] = "r3";
          }
          
        } else {

          var name = graphic.attributes.NAME.split(' ')[0] + ' ' +graphic.attributes.LAST_NAME;

          if ( self.memberCommitteeCount[ name ] <= 1 ) {
            graphic.attributes[ "schema" ] = "d0";
          } else if ( self.memberCommitteeCount[ name ] > 1 && self.memberCommitteeCount[ name ] < 5 ) {
            graphic.attributes[ "schema" ] = "d1";
          } else if ( self.memberCommitteeCount[ name ] >= 5 && self.memberCommitteeCount[ name ] < 9 ) {
            graphic.attributes[ "schema" ] = "d2";
          } else {
            graphic.attributes[ "schema" ] = "d3";
          }

        }
      });
    });

    var defaultSymbol = new SimpleFillSymbol();
      defaultSymbol.outline.setStyle(SimpleLineSymbol.STYLE_DASH, new Color([255,255,255,255]), 3);

    var renderer = new UniqueValueRenderer(defaultSymbol, "schema");
    renderer.addValue("d0", new SimpleFillSymbol().setColor(new Color([222,235,247, 0.7])));
    renderer.addValue("d1", new SimpleFillSymbol().setColor(new Color([189,215,231, 0.7])));
    renderer.addValue("d2", new SimpleFillSymbol().setColor(new Color([158,202,225, 0.7])));
    renderer.addValue("d3", new SimpleFillSymbol().setColor(new Color([49,130,189, 0.7])));
    
    renderer.addValue("r0", new SimpleFillSymbol().setColor(new Color([254,224,210, 0.7])));
    renderer.addValue("r1", new SimpleFillSymbol().setColor(new Color([252,174,145, 0.7])));
    renderer.addValue("r2", new SimpleFillSymbol().setColor(new Color([252,146,114, 0.7])));
    renderer.addValue("r3", new SimpleFillSymbol().setColor(new Color([222,45,38, 0.7])));

    var json = renderer.toJson();
    $.each(json.uniqueValueInfos, function(i,sys) {
      sys.symbol.outline = {
        color: [225,225,225,255],
        style:"esriSLSSolid",
        width:0.3,
        type:"esriSLS"
      }
    });

    var rend = new UniqueValueRenderer(json);

    self.featureLayerGen.setRenderer( rend );
    self.featureLayerGen.redraw();

    self.featureLayer.setRenderer( rend );
    self.featureLayer.redraw();

  });

}






/*
* Get legislator by point on map [ via mapClick ]
*
*/ 
App.prototype._getLegByLatLong = function(e) {
  var self = this;

  $('#col-left').fadeOut();
  $('#committees').hide();
  $('#committees-empty').hide();
  $('#pie-chart-votes').empty();
  $('#pie-chart-party-line').empty();
    
  this._clearUI();

  var lat, lon;
  if ( e.mapPoint ) {
    var mapPoint = e.mapPoint;
    lon = mapPoint.getLongitude().toFixed(2);
    lat = mapPoint.getLatitude().toFixed(2);
  } else {
    lat = e.latitude;
    lon = e.longitude;
  };

  var url = "https://congress.api.sunlightfoundation.com/legislators/locate?latitude="+lat+"&longitude="+lon+"&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  $('.legislator').hide(); //hide previous selection

  //sunlight api lookup
  $.getJSON(url, function(data) {
    
    var leg_ordered_arr = [];
    $.each(data.results, function(i, rep ) {
      if(rep.chamber === 'house'){
        leg_ordered_arr[0] = rep;
      } else if (rep.chamber === 'senate' && rep.state_rank === 'junior') {
        leg_ordered_arr[1] = rep;
      } else {
        leg_ordered_arr[2] = rep;
      }
    });
    
    self.committees = {}; //reset committees array
    $('.media-object').show(); //make sure all images are viz
    $('.glyphicon-user').hide();

    $.each(leg_ordered_arr, function(i, rep) {  

      //highlight map
      if ( rep.district ) { 
        self._selectDistrict( rep.district, rep.state ); 
      }

      //set current committees
      self._getCommittees(rep);

      //update UI
      $($('.legislator')[ i ]).find('.media-object').attr('src', 'assets/images/'+rep.bioguide_id+'.jpg');
      $($('.legislator')[ i ]).find('.media-heading').html('['+rep.party+'] '+ rep.title + '. ' + rep.first_name + ' ' + rep.last_name);
      $($('.legislator')[ i ]).find('.state-name').html(rep.state_name);
      $($('.legislator')[ i ]).find('.rank-name').html( (rep.state_rank) ? rep.state_rank.slice(0,1).toUpperCase() + rep.state_rank.slice(1) : rep.district );
      $($('.legislator')[ i ]).find('.rank-title').html( (rep.state_rank) ? "State Rank" : "District" );
      
      //set bottom border of info card to affiliated party
      if(rep.party === "D"){
        $($('.legislator')[ i ]).find('.legislator-inner-party-border').css( "border-bottom", "solid 8px #2171b5" );
      } else if( rep.party === "R") {
        $($('.legislator')[ i ]).find('.legislator-inner-party-border').css( "border-bottom", "solid 8px #cb181d" );
      } else {
        $($('.legislator')[ i ]).find('.legislator-inner-party-border').css( "border-bottom", "solid 8px #FFF" );
      }; 
      
      $($('.legislator')[ i ]).show();

      //show icon for missing rep photos
      $("img").error(function () {
        $(this).parent().parent().find('.glyphicon-user').show();
        $(this).unbind("error").hide(); //attr("src", "broken.gif");
      });
    
    });
    
    //select first rep
    setTimeout(function() {
      $($('.legislator')[0]).trigger('click');
    },1000);

  });

}





/*
* Get legislator by first name -- matches with last
*
*/ 
App.prototype._getLegByName = function(name) {
  var self = this;

  $('#col-left').fadeOut();
  $('#committees').hide();
  $('#committees-empty').hide();
  //$('#pie-chart-votes').empty();
  //$('#pie-chart-party-line').empty();
  
  this._clearUI();

  var first_name = name.split(' ')[ 0 ];
  var last_name = name.split(' ')[ 1 ];

  //sunlight api lookup by NAME
  var url = "https://congress.api.sunlightfoundation.com/legislators?query="+first_name+"&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  $.getJSON(url, function(data) {
    //console.log(data);
    
    var leg_ordered_arr = [];
    $.each(data.results, function(i, rep ) {
      if(rep.chamber === 'house'){
        leg_ordered_arr[0] = rep;
      } else if (rep.chamber === 'senate' && rep.state_rank === 'junior') {
        leg_ordered_arr[1] = rep;
      } else {
        leg_ordered_arr[2] = rep;
      }
    });
    
    self.committees = {}; //reset committees array
    $('.legislator').hide(); //hide previous selection
    $('.media-object').show(); //make sure all images are viz
    $('.glyphicon-user').hide();

    $.each(leg_ordered_arr, function(i, rep) {
      if ( rep.last_name === last_name ) {
        self._getCommittees(rep);
        
        //highlight map
        if ( rep.district ) { 
          self._selectDistrict( rep.district, rep.state ); 
        } else {
          self._selectState( rep.state );
        }

        //Update UI
        $('.legislator').hide();
        $($('.legislator')[ 0 ]).find('.media-object').attr('src', 'assets/images/'+rep.bioguide_id+'.jpg');
        $($('.legislator')[ 0 ]).find('.media-heading').html('['+rep.party+'] '+ rep.title + '. ' + rep.first_name + ' ' + rep.last_name);
        $($('.legislator')[ 0 ]).find('.state-name').html(rep.state_name);
        $($('.legislator')[ 0 ]).find('.rank-name').html( (rep.state_rank) ? rep.state_rank : rep.district );
        $($('.legislator')[ 0 ]).find('.rank-title').html( (rep.state_rank) ? "State Rank" : "District" );
        
        //set bottom border of info card to affiliated party
        if(rep.party === "D"){
          $($('.legislator')[ 0 ]).find('.legislator-inner-party-border').css( "border-bottom", "solid 10px #2171b5" );
        } else if( rep.party === "R") {
          $($('.legislator')[ 0 ]).find('.legislator-inner-party-border').css( "border-bottom", "solid 10px #cb181d" );
        } else {
          $($('.legislator')[ 0 ]).find('.legislator-inner-party-border').css( "border-bottom", "solid 10px #FFF" );
        }; 
        
        $($('.legislator')[ 0 ]).show();
      }

      $("img").error(function () {
        $(this).parent().parent().find('.glyphicon-user').show();
        $(this).unbind("error").hide(); //attr("src", "broken.gif");
      });

    });

    //select first rep
    setTimeout(function() {
      $($('.legislator')[0]).trigger('click');
    },1000);

  });
  
};



/*
* Get legislators by ZIPCODE
*
*/ 
App.prototype._getLegByZipcode = function(zipcode) {
  var self = this;
  
  $('#col-left').fadeOut();
  $('#committees').hide();
  $('#committees-empty').hide();
  this._clearUI();

  var url = "https://congress.api.sunlightfoundation.com/legislators/locate?zip="+zipcode+"&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  //sunlight api lookup
  $.getJSON(url, function(data) {
    self.committees = {}; //reset committees array
    $('.legislator').hide(); //hide previous selection
    
    var leg_ordered_arr = [];
    $.each(data.results, function(i, rep ) {
      if(rep.chamber === 'house'){
        leg_ordered_arr[0] = rep;
      } else if (rep.chamber === 'senate' && rep.state_rank === 'junior') {
        leg_ordered_arr[1] = rep;
      } else {
        leg_ordered_arr[2] = rep;
      }
    });

    $.each(leg_ordered_arr, function(i, rep) {
      
      //highlight map
      if ( rep.district ) { 
        self._selectDistrict( rep.district, rep.state ); 
      }

      //set current committees
      self._getCommittees(rep);

      $($('.legislator')[ i ]).find('.media-object').attr('src', 'assets/images/'+rep.bioguide_id+'.jpg');
      $($('.legislator')[ i ]).find('.media-heading').html('['+rep.party+'] '+ rep.title + '. ' + rep.first_name + ' ' + rep.last_name);
      $($('.legislator')[ i ]).find('.state-name').html(rep.state_name);
      $($('.legislator')[ i ]).find('.rank-name').html( (rep.state_rank) ? rep.state_rank.slice(0,1).toUpperCase() + rep.state_rank.slice(1) : rep.district );
      $($('.legislator')[ i ]).find('.rank-title').html( (rep.state_rank) ? "State Rank" : "District" );
      
      //set bottom border of info card to affiliated party
      if(rep.party === "D"){
        $($('.legislator')[ i ]).find('.legislator-inner-party-border').css( "border-bottom", "solid 10px #2171b5" );
      } else if( rep.party === "R") {
        $($('.legislator')[ i ]).find('.legislator-inner-party-border').css( "border-bottom", "solid 10px #cb181d" );
      } else {
        $($('.legislator')[ i ]).find('.legislator-inner-party-border').css( "border-bottom", "solid 10px #FFF" );
      }; 
      
      $($('.legislator')[ i ]).show();

    });

  });
  
  //select first rep
  setTimeout(function() {
    $($('.legislator')[0]).trigger('click');
  },1000);
  
};





/*
* Get committees
* Function gets list of committees the CURRENTLY SELECTED members are a member of
* this.committees is recreated each time a new district is selected
*
*/ 
App.prototype._getCommittees = function(rep) {
  var self = this;

  //committee by member id url
  var url = "https://congress.api.sunlightfoundation.com/committees?member_ids="+rep.bioguide_id+"&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  //get all committees for member
  var member = (rep.first_name + rep.last_name).replace(/ /g, '');

  this.committees[ member ] = { committees: [] };
  
  $.getJSON(url, function(data) {
    //console.log(data);
    self.committees[ member ].committees = data.results;
  });

}




/*
* Show committees
* Shows list of committees in UI
*
*/ 
App.prototype._showCommittees = function(name) {
  var self = this;

  this._clearUI();
  $('#committees').show().height('400px');

  var committees = this.committees[ name.replace(/ /g, '') ].committees;
  $.each(committees, function(i, committee) {
    var cmte = '<div class="committee" title="'+committee.name+'">'+committee.name+' ('+committee.chamber+')</div>';
    $('#committees').append(cmte);
  });
  
  var header = '<h3>'+name+' is a Member of <strong>'+ committees.length + '</strong> Committees</h3>';
  $('#committees').prepend(header);
  
  //bind committee hovers
  $('.committee').on('click', function(e) {
    $('.committee').removeClass('selected');
    $(this).addClass('selected');
    var id = $(this).attr('title');
    self._showCommitteeMembers( id );
  });
} 



/*
* Show MEMBERS OF a committee
* On committee select, show all members of that committee, wire ability to search off that committee member
*
*/ 
App.prototype._showCommitteeMembers = function(name) {
  var self = this;
  var committees = this.allCommittees.results;
  
  $('#committee-members').show();

  $.each(committees, function(i, committee) {
    if (committee.name === name) {
      if ( committee.members.length > 0 ) {
        
        $('#committee-members').empty();
        var header = '<h3>Members of the '+name+' Committee</h3>';
        $('#committee-members').append(header);

        $.each(committee.members, function(i, rep) {
          var face;
          if(rep.legislator.party === 'D'){
            face = '<img class="committee-member-photos committee-member-photos-dem" data-toggle="tooltip" data-placement="top" title="'+rep.legislator.first_name +' '+ rep.legislator.last_name+' ['+ rep.legislator.party +' - '+rep.legislator.state+']" id="'+rep.legislator.first_name +' '+ rep.legislator.last_name+'" src="assets/images/'+rep.legislator.bioguide_id+'.jpg"></img>';
          } else if (rep.legislator.party === 'R'){
            face = '<img class="committee-member-photos committee-member-photos-rep" data-toggle="tooltip" data-placement="top" title="'+rep.legislator.first_name +' '+ rep.legislator.last_name+' ['+ rep.legislator.party +' - '+rep.legislator.state+']" id="'+rep.legislator.first_name +' '+ rep.legislator.last_name+'" src="assets/images/'+rep.legislator.bioguide_id+'.jpg"></img>';           
          } else {
            face = '<img class="committee-member-photos committee-member-photos-ind" data-toggle="tooltip" data-placement="top" title="'+rep.legislator.first_name +' '+ rep.legislator.last_name+' ['+ rep.legislator.party +' - '+rep.legislator.state+']" id="'+rep.legislator.first_name +' '+ rep.legislator.last_name+'" src="assets/images/'+rep.legislator.bioguide_id+'.jpg"></img>';            
          }
          $('#committee-members').append( face );
        });
      }
    }
  });
  $('#committees').css({'height': '125px'});
  $('.committee-member-photos').tooltip();
  $('.committee-member-photos').on('click', function(e) {
    //$('#pie-chart-votes').empty();
    //$('#pie-chart-party-line').empty();
    var id = e.target.id;
    self._getLegByName( id );
  });
  
  
  $("img").error(function () {
        $(this).parent().parent().find('.glyphicon-user').show();
        $(this).unbind("error").hide(); //attr("src", "broken.gif");
  });

} 




/*
* Member details
* When member is selected, show their details (address, phone, contact)
* Initiates call to GET VOTES, which populates voting record for specified Rep 
*/
App.prototype._showMemberDetails = function(name) {
  var self = this;

  $('#col-left').show();
  $('#member-name').html(name);
  
  $.each(this.allLegislators, function(i, leg) {
    var n = name.split('.')[1].split(' ');
    if ( leg.first_name === n[1] && leg.last_name === n[2]) {
      $('#member-details').fadeIn();
      $('#address').html(leg.office);
      $('#telephone').html(leg.phone);
      
      $('.icon-homepage').attr("href", leg.website);
      $('.icon-homepage').attr("target", "_blank");
      
      $('.icon-twitter').attr("href", "http://www.twitter.com/"+leg.twitter_id);
      $('.icon-twitter').attr("target", "_blank");
      
      $('.icon-facebook').attr("href", "http://www.facebook.com/"+leg.facebook_id);
      $('.icon-facebook').attr("target", "_blank");
      
      $('.icon-youtube').attr("href", "http://www.youtube.com/"+leg.youtube_id);
      $('.icon-youtube').attr("target", "_blank");
      
      $('.icon-email').attr("href", leg.contact_form);
      $('.icon-email').attr("target", "_blank");
      
      //self._getVotesById(leg.bioguide_id);
    }
  });

}




/*
* Takes rep id
* Does search to Sunlight votes API 
* Populates UI with voting record, and break down of last 50 votes by specified Rep
*
*/
App.prototype._getVotesById = function(id) {
  var self = this;

  //$('#voting-record').hide();
  //$('.voting-loader').show();

  //get vote history for selected member
  var url = "https://congress.api.sunlightfoundation.com/votes?apikey=88036ea903bf4dffbbdc4a9fa7acb2ad&voter_ids."+id+"__exists=true&per_page=100&fields=voters,result,bill,breakdown.total,breakdown.party"
  
  var votes = {"Yea": 0, "Nay": 0, "Present": 0, "Not Voting": 0};
  self.partyLine = {"with": 0, "against": 0};

  if (self.voteRequest !== undefined ) {
    self.voteRequest.abort();
  }
  self.voteRequest = $.getJSON(url, function(data) {
    //console.log('data', data);
    
    $.each(data.results, function(i, res) {
      for ( var voter in res.voters ) {
        if ( voter === id ) {
          if (res.breakdown.party) {
            self._getPartyLine(voter, res);
          }
          if (res.bill) {
            $('#bills-container').show();
            var d = ( res.bill.last_vote_at ) ? res.bill.last_vote_at : res.bill.last_action_at;
            var item = '<div class="bill"><h4>'+res.bill.bill_id+'</h4>\
                <h5>'+res.bill.official_title+'</h5>\
                <div class="col-md-5 col-sm-5 col-xs-4">Result: <span class="'+res.result+'">'+res.result+'</span></div>\
                <div class="col-md-2 col-sm-2 col-xs-2">Yea: <span>'+res.breakdown.total.Yea+'</span></div>\
                <div class="col-md-2 col-sm-2 col-xs-2">Nay: <span>'+res.breakdown.total.Nay+'</span></div>\
                <div class="col-md-3 col-sm-3 col-xs-3">Present: <span>'+res.breakdown.total.Present+'</span></div>\
                <div class="col-md-12 col-sm-12 col-xs-12">How '+res.voters[ voter ].voter.title+'. ' + res.voters[ voter ].voter.first_name + ' ' +res.voters[ voter ].voter.last_name + ' voted: '+ res.voters[ voter ].vote +'</div>\
                <div class="col-md-6 col-sm-6 col-xs-6" id="bill-date">URL: <a href="'+res.bill.urls.congress+'">'+res.bill.urls.congress+'</a></div>\
                <div class="col-md-6 col-sm-6 col-xs-6">Last Vote At: '+new Date( d ).toLocaleString()+'</div>\
              </div>';

            $('#bills').append(item);
          }
          //tally recent votes!
          votes[ res.voters[ voter ].vote ]++;

          $('#term-start').html(moment(res.voters[ voter ].voter.term_start).format("MMMM DD, YYYY"));
          $('#term-end').html(moment(res.voters[ voter ].voter.term_end).format("MMMM DD, YYYY"));
        }
      };
    });
    
    $('#pie-chart-votes').empty();
    $('#pie-chart-party-line').empty();
    self._partyLinePie();
    self._pieChart(votes);

    $('.voting-loader').hide();
    $('#voting-record').fadeIn();
    $('#total-votes').html(data.count.toLocaleString());
  });

}

/*
* Calculate how often a rep votes with party (last 50 votes)
*
*/
App.prototype._getPartyLine = function(voter, res) {
  var self = this;
  var voted = res.voters[ voter ].vote;
  var party = res.voters[ voter ].voter.party;
  var partyline = ( res.breakdown.party[ party ].Yea > res.breakdown.party[ party ].Nay ) ? "Yea" : "Nay";
  
  if ( voted === partyline ) {
    this.partyLine['with']++;
  } else {
    this.partyLine['against']++;
  }
}


/*
* Empties, clears, hides UI elements as needed
* TODO Build this out to handle more
*
*/
App.prototype._clearUI = function() {
  $('#committees').empty();
  $('#committee-members').empty();
  $('#bills').empty();
  $('#pie-chart-votes').empty();
  $('#pie-chart-party-line').empty();
  $('#committees').hide();
  $('#committees-empty').hide();
  $('#bills-container').hide();
}