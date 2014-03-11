var App = function(){

  //resize map container
  var height = $(window).height() - 200;
  $('#map').css('height', height+'px');

  this.initMap();
};

App.prototype.initMap = function() {
  var self = this;

  require(["esri/map", "esri/layers/ArcGISTiledMapServiceLayer", 
    "esri/layers/FeatureLayer"], 
    function(Map, ArcGISTiledMapServiceLayer, FeatureLayer) { 

    // hook up elevation slider events
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

    //add districts
    //var districtsUrl = "http://dcdev.esri.com/arcgis/rest/services/Congress/DistrictsByParty/MapServer";
    //var districtsLayer = new ArcGISTiledMapServiceLayer(districtsUrl, {
    //  opacity: 0.8
    //});
    //var url = "http://services.arcgis.com/bkrWlSKcjUDFDtgw/arcgis/rest/services/districts113/FeatureServer";
    self.featureLayer = new FeatureLayer("http://services.arcgis.com/bkrWlSKcjUDFDtgw/arcgis/rest/services/districts113/FeatureServer/0",{
      mode: esri.layers.FeatureLayer.SNAPSHOT,
      outFields: ["*"]
    });

    self.map.addLayer(self.featureLayer);
    self.featureLayer.on('update-end', function(obj) {
      self._styleMap();
    });

    self._wire();
    self._getAllLegNames();
    self._getAllCommittees();

  });

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
    $('#map').css('height', height+'px');

  });

  //map events
  this.map.on('click', function(e) {
    self._getLegByLatLong(e);
  });

  self.featureLayer.on('mouse-over', function(e) {
    self._featureSelected( e.graphic, 'mouse-over' );
  });

  self.featureLayer.on('mouse-out', function(e) {
    self._removeSelectedFeature( 'mouse-over' );
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
  $('.legislator').on('click mouseenter', function(e) {
    var name = $(this).find('.media-heading').html();
    self._showCommittees(name.split('.')[1]);
  });

  $( document ).ajaxStart(function() {
    NProgress.start();
  });

  $( document ).ajaxStop(function() {
    NProgress.done();
  });
}


/*
* Select polygons
*
*/
App.prototype._featureSelected = function(graphicJson, type) {
  //remove previously selected graphic 
  this._removeSelectedFeature(type);

  //add selected graphic
  var id = ( type === "mouse-over" ) ? "hoverGraphic" : "selectedGraphic";
  
  var graphic = {};
  graphic.geometry = graphicJson.geometry;
  graphic.symbol = {};
  graphic.attributes = { id: id }


  graphic.symbol = {
    "color":[255,255,255,64],"outline":{"color":[255,255,255,255],
    "width":2,"type":"esriSLS","style":"esriSLSSolid"},
    "type":"esriSFS","style":"esriSFSSolid"
  };


  var g = new esri.Graphic( graphic );
  
  //add to map
  this.map.graphics.add( g );
}


App.prototype._selectDistrict = function(district, state) {
  var self = this;
  var g;
  $.each(this.featureLayer.graphics, function(i, graphic) {
    if ( parseInt(graphic.attributes.DISTRICT) === district && graphic.attributes.STATENAME === state ) {
      g = graphic;
    }
  });
  this._featureSelected(g, 'click');

}

/*
* Remove selected polygon
*
*/
App.prototype._removeSelectedFeature = function(type) {
  var self = this;

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


/*
* Get ALL member names
*
*/ 
App.prototype._getAllLegNames = function() {
  var self = this;
  var url = "https://congress.api.sunlightfoundation.com/legislators?per_page=all&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  //sunlight api lookup
  this.legislators = [];
  this.theme = {};
  $.getJSON(url, function(data) {
    
    $.each(data.results, function(i, rep) {
      if ( rep.district ) {
        self.theme[ rep.district ] = rep.party;
      }
      self.legislators.push(rep.first_name + ' ' + rep.last_name);
    });

    $('#search-reps').typeahead({
      name: "reps",
      local: self.legislators
    });

  });

}


/*
* Classbreaks styling of main feature layer
*
*
*/
App.prototype._styleMap = function() {
  var self = this;

  var breaks = self.theme;
  require(["esri/renderers/SimpleRenderer",
    "esri/renderers/ClassBreaksRenderer", "esri/symbols/SimpleFillSymbol",
    "dojo/_base/Color", "dojo/dom-style"], 
    function(SimpleRenderer, ClassBreaksRenderer, SimpleFillSymbol, Color, domStyle) { 

    //console.log('grpahics', app.featureLayer.graphics.length);
    $.each(self.featureLayer.graphics, function(i, graphic) {
      //console.log('info', graphic);

    });
    var symbol = new SimpleFillSymbol();
    symbol.setColor(new Color([150, 150, 150, 0.5]));

    var renderer = new ClassBreaksRenderer(symbol, "DISTRICT");
    renderer.addBreak(0, 25, new SimpleFillSymbol().setColor(new Color([56, 168, 0, 0.5])));
    renderer.addBreak(25, 75, new SimpleFillSymbol().setColor(new Color([139, 209, 0, 0.5])));
    renderer.addBreak(75, 175, new SimpleFillSymbol().setColor(new Color([255, 255, 0, 0.5])));
    renderer.addBreak(175, 400, new SimpleFillSymbol().setColor(new Color([255, 128, 0, 0.5])));
    renderer.addBreak(400, Infinity, new SimpleFillSymbol().setColor(new Color([255, 0, 0, 0.5])));

    self.featureLayer.setRenderer(renderer);
    self.featureLayer.redraw();

    console.log('restyle feature layer!')
    //self.map.featureLayer.enableMouseEvents();
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
* Get legislator by point on map [ via mapClick ]
*
*/ 
App.prototype._getLegByLatLong = function(e) {
  var self = this;

  var mapPoint = e.mapPoint;
  var lon = mapPoint.getLongitude().toFixed(2);
  var lat = mapPoint.getLatitude().toFixed(2);

  var url = "https://congress.api.sunlightfoundation.com/legislators/locate?latitude="+lat+"&longitude="+lon+"&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  $('.legislator').hide(); //hide previous selection

  //sunlight api lookup
  $.getJSON(url, function(data) {
    
    self.committees = {}; //reset committees array
    $('.media-object').show(); //make sure all images are viz
    $('.glyphicon-user').hide();

    $.each(data.results, function(i, rep) {

      //highlight map
      if ( rep.district ) { 
        self._selectDistrict( rep.district, rep.state_name ); 
      }

      //set current committees
      self._getCommittees(rep);

      //update UI
      $($('.legislator')[ i ]).find('.media-object').attr('src', 'assets/images/'+rep.bioguide_id+'.jpg');
      $($('.legislator')[ i ]).find('.media-heading').html('['+rep.party+'] '+ rep.title + '. ' + rep.first_name + ' ' + rep.last_name);
      $($('.legislator')[ i ]).find('.state-name').html(rep.state_name);
      $($('.legislator')[ i ]).find('.rank-name').html( (rep.state_rank) ? rep.state_rank : "" );
      $($('.legislator')[ i ]).show();

      //show icon for missing rep photos
      $("img").error(function () {
        $(this).parent().parent().find('.glyphicon-user').show();
        $(this).unbind("error").hide(); //attr("src", "broken.gif");
      });

    });

  });

}



/*
* Get legislator by first name -- matches with last
*
*/ 
App.prototype._getLegByName = function(name) {
  var self = this;

  var first_name = name.split(' ')[ 0 ];
  var last_name = name.split(' ')[ 1 ];

  //sunlight api lookup by NAME
  var url = "https://congress.api.sunlightfoundation.com/legislators?query="+first_name+"&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  $.getJSON(url, function(data) {
    
    self.committees = {}; //reset committees array
    $('.legislator').hide(); //hide previous selection
    $('.media-object').show(); //make sure all images are viz
    $('.glyphicon-user').hide();

    $.each(data.results, function(i, rep) {
      if ( rep.last_name === last_name ) {
        self._getCommittees(rep);
        
        //highlight map
        if ( rep.district ) { 
          self._selectDistrict( rep.district, rep.state_name ); 
        }

        $('.legislator').hide();
        $($('.legislator')[ 0 ]).find('.media-object').attr('src', 'assets/images/'+rep.bioguide_id+'.jpg');
        $($('.legislator')[ 0 ]).find('.media-heading').html('['+rep.party+'] '+ rep.title + '. ' + rep.first_name + ' ' + rep.last_name);
        $($('.legislator')[ 0 ]).find('.state-name').html(rep.state_name);
        $($('.legislator')[ 0 ]).find('.rank-name').html( (rep.state_rank) ? rep.state_rank : "" );
        $($('.legislator')[ 0 ]).show();
      }

      $("img").error(function () {
        $(this).parent().parent().find('.glyphicon-user').show();
        $(this).unbind("error").hide(); //attr("src", "broken.gif");
      });

    });

  });
  
};

/*
* Get legislator by first name -- matches with last
*
*/ 
App.prototype._getLegByZipcode = function(zipcode) {
  var self = this;
  
  var url = "https://congress.api.sunlightfoundation.com/legislators/locate?zip="+zipcode+"&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  //sunlight api lookup
  $.getJSON(url, function(data) {
    
    self.committees = {}; //reset committees array
    $('.legislator').hide(); //hide previous selection

    $.each(data.results, function(i, rep) {

      //highlight map
      if ( rep.district ) { 
        self._selectDistrict( rep.district, rep.state_name ); 
      }

      //set current committees
      self._getCommittees(rep);

      $($('.legislator')[ i ]).find('.media-object').attr('src', 'assets/images/'+rep.bioguide_id+'.jpg');
      $($('.legislator')[ i ]).find('.media-heading').html('['+rep.party+'] '+ rep.title + '. ' + rep.first_name + ' ' + rep.last_name);
      $($('.legislator')[ i ]).find('.state-name').html(rep.state_name);
      $($('.legislator')[ i ]).find('.rank-name').html( (rep.state_rank) ? rep.state_rank : "" );
      $($('.legislator')[ i ]).show();

    });

  });

  
};



/*
* Get committees
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
    self.committees[ member ].committees = data.results;
  });

}

/*
* Get members OF a committee
*
*/ 
App.prototype._getCommitteeMembers = function(rep) {
  var self = this;

  //committee by member id url
  var url = "https://congress.api.sunlightfoundation.com/committees?member_ids="+rep.bioguide_id+"&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  //get all committees for member
  var member = (rep.first_name + rep.last_name).replace(/ /g, '');

  this.committees[ member ] = { committees: [] };
  
  $.getJSON(url, function(data) {
    self.committees[ member ].committees = data.results;
  });

}


/*
* Show committees
*
*/ 
App.prototype._showCommittees = function(name) {
  var self = this;

  $('#committees').empty();
  $('#committee-members').empty();

  var header = '<h3>Member '+name+' Committees</h3>';
  $('#committees').append(header);

  var committees = this.committees[ name.replace(/ /g, '') ].committees;
  $.each(committees, function(i, committee) {
    var cmte = '<div class="committee" title="'+committee.name+'">'+committee.name+' ('+committee.chamber+')</div>';
    $('#committees').append(cmte);
  });

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
*
*/ 
App.prototype._showCommitteeMembers = function(name) {
  var self = this;
  var committees = this.allCommittees.results;

  $.each(committees, function(i, committee) {
    if (committee.name === name) {
      if ( committee.members.length > 0 ) {
        
        $('#committee-members').empty();
        var header = '<h3>Members of the '+name+' Committee</h3>';
        $('#committee-members').append(header);

        $.each(committee.members, function(i, rep) {
          var face = '<img src="assets/images/'+rep.legislator.bioguide_id+'.jpg"></img>';
          $('#committee-members').append( face );
        });

      }
    }
  });

} 




