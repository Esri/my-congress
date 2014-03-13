var App = function(){

  //resize map container
  var height = $(window).height() - 200;
  var width = $(window).width();
  $('#map').css('height', height+'px');
  $('#congress-seal').css('margin-left', (width / 2) - 25 + 'px');

  this._getAllCommittees();
  this._getAllLegNames();
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
    /*
    esriConfig.defaults.map.basemaps.darkgray = {
      baseMapLayers: [
        { url: "http://tiles4.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Dark_Gray_Base_Beta/MapServer" }
      ],
      title: "Dark Gray"
    };
    */

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
    //self.featureLayer = new FeatureLayer("http://services.arcgis.com/bkrWlSKcjUDFDtgw/arcgis/rest/services/districts113/FeatureServer/0",{
    self.featureLayerGen = new FeatureLayer("http://services1.arcgis.com/o90r8yeUBWgKSezU/arcgis/rest/services/Congressional_Districts_outlines/FeatureServer/2",{
      outFields: ["*"]
    });

    self.featureLayer = new FeatureLayer("http://services1.arcgis.com/o90r8yeUBWgKSezU/arcgis/rest/services/Congressional_Districts_outlines/FeatureServer/1",{
      mode: esri.layers.FeatureLayer.MODE_SNAPSHOT,
      outFields: ["*"]
    });

    self.map.addLayer(self.featureLayerGen);
    self.map.addLayer(self.featureLayer);

    self.featureLayerGen.on('update-end', function(obj) {
      self._styleMap();
    });

    self.featureLayer.on('update-end', function(obj) {
      self._styleMap();
    });

    self._wire();

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
    var width = $(window).width();
    
    $('#map').css('height', height+'px');
    $('#congress-seal').css('margin-left', (width / 2) - 25 + 'px');

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
    self._showMemberDetails(name);
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

  if (!graphicJson) return;

  //remove previously selected graphic 
  this._removeSelectedFeature(type);

  //set selected graphic on the app
  if ( type === "click" ) {
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
* Get ALL member names
*
*/ 
App.prototype._getAllLegNames = function() {
  var self = this;
  var url = "https://congress.api.sunlightfoundation.com/legislators?per_page=all&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  //sunlight api lookup
  this.legislators = [];
  this.allLegislators = [];

  this.theme = {};
  $.getJSON(url, function(data) {

    //save array of all leg for later use
    self.allLegislators = data.results;

    //save just names for 'typeahead'
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
    
    self._buildStyler();

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

  if ( !self._mapStyled ) this._styleMap();

}


/*
* Classbreaks styling of main feature layer
* INSANE 
*
*/
App.prototype._styleMap = function() {
  var self = this;

  if ( !this.memberCommitteeCount || this.featureLayer.graphics.length <= 5 ) return; 
  this._mapStyled = true;
  
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
* Set Map Extent
*
*/
App.prototype._setMapExtent = function() {
  var extent = this.selectedGraphic.geometry.getExtent();
  //console.log('extent', extent);
  this.map.setExtent(extent.expand(5));
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
    self._buildStyler();
  });
}


/*
* Get legislator by point on map [ via mapClick ]
*
*/ 
App.prototype._getLegByLatLong = function(e) {
  var self = this;

  $('#col-left').fadeOut();
  this._clearUI();

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
        self._selectDistrict( rep.district, rep.state ); 
      }

      //set current committees
      self._getCommittees(rep);

      //update UI
      $($('.legislator')[ i ]).find('.media-object').attr('src', 'assets/images/'+rep.bioguide_id+'.jpg');
      $($('.legislator')[ i ]).find('.media-heading').html('['+rep.party+'] '+ rep.title + '. ' + rep.first_name + ' ' + rep.last_name);
      $($('.legislator')[ i ]).find('.state-name').html(rep.state_name);
      $($('.legislator')[ i ]).find('.rank-name').html( (rep.state_rank) ? rep.state_rank : rep.district );
      $($('.legislator')[ i ]).find('.rank-title').html( (rep.state_rank) ? "State Rank" : "District" );
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

  $('#col-left').fadeOut();
  this._clearUI();

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
          self._selectDistrict( rep.district, rep.state ); 
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
  
  $('#col-left').fadeOut();
  this._clearUI();

  var url = "https://congress.api.sunlightfoundation.com/legislators/locate?zip="+zipcode+"&apikey=88036ea903bf4dffbbdc4a9fa7acb2ad";

  //sunlight api lookup
  $.getJSON(url, function(data) {
    
    self.committees = {}; //reset committees array
    $('.legislator').hide(); //hide previous selection

    $.each(data.results, function(i, rep) {

      //highlight map
      if ( rep.district ) { 
        self._selectDistrict( rep.district, rep.state ); 
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

  this._clearUI();
  $('#committees').show().height('400px');

  var header = '<h3>Committees '+name+' is Member of</h3>';
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
  
  $('#committee-members').show();

  $.each(committees, function(i, committee) {
    if (committee.name === name) {
      if ( committee.members.length > 0 ) {
        
        $('#committee-members').empty();
        var header = '<h3>Members of the '+name+' Committee</h3>';
        $('#committee-members').append(header);

        $.each(committee.members, function(i, rep) {
          var face = '<img class="committee-member-photos" data-toggle="tooltip" data-placement="top" title="'+rep.legislator.first_name +' '+ rep.legislator.last_name+'" id="'+rep.legislator.first_name +' '+ rep.legislator.last_name+'" src="assets/images/'+rep.legislator.bioguide_id+'.jpg"></img>';
          $('#committee-members').append( face );
        });

      }
    }
  });
  $('#committees').css({'height': '125px'});
  $('.committee-member-photos').tooltip();
  $('.committee-member-photos').on('click', function(e) {
    var id = e.target.id;
    self._getLegByName( id );
  });

} 


/*
* Member details
*
*
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
      $('#online-contact').html("<a href="+leg.contact_form+">Online Contact</a>");
      self._getVotesById(leg.bioguide_id);
    }
  });

}


/*
*
*
*
*/
App.prototype._getVotesById = function(id) {
  var self = this;

  $('#voting-record').hide();
  $('.voting-loader').show();

  //get vote history for selected member
  var url = "https://congress.api.sunlightfoundation.com/votes?apikey=88036ea903bf4dffbbdc4a9fa7acb2ad&voter_ids."+id+"__exists=true&per_page=100&fields=voters,result,breakdown.total"
  
  var votes = {"Yea": 0, "Nay": 0, "Present": 0, "Not Voting": 0}
  $.getJSON(url, function(data) {
    //console.log('data', data);
    
    $.each(data.results, function(i, res) {
      for ( var voter in res.voters ) {
        if ( voter === id ) {
          votes[ res.voters[ voter ].vote ]++;
        }
      };
    });
    $('.voting-loader').hide();
    $('#voting-record').fadeIn();
    $('#total-votes').html(data.count.toLocaleString());
    $('#last-50-yea').html(votes.Yea);
    $('#last-50-nay').html(votes.Nay);
    $('#last-50-present').html(votes.Present);
    $('#last-50-not-voting').html(votes["Not Voting"]);
  });

}



/*
* Empties, clears, hides UI elements as needed
*
*
*/
App.prototype._clearUI = function() {
  $('#committees').empty();
  $('#committee-members').empty();
  $('#committees').hide();
  $('#committees-empty').hide();
}

