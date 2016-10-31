L.TimeDimension.Layer.MaS = L.TimeDimension.Layer.GeoJson.extend(
  {
    
    _update: function () {
      if (!this._map)
        return;
      if (!this._loaded) {
        return;
      }
      
      var time = this._timeDimension.getCurrentTime();
      
      var maxTime = this._timeDimension.getCurrentTime(),
        minTime = 0;
      if (this._duration) {
        var date = new Date(maxTime);
        L.TimeDimension.Util.subtractTimeDuration(date, this._duration, true);
        minTime = date.getTime();
      }
      
      // new coordinates:
      var layer = L.geoJson(null, this._baseLayer.options);
      var layers = this._baseLayer.getLayers();
      for (var i = 0, l = layers.length; i < l; i++) {
        var feature = this._getFeatureBetweenDates(layers[i].feature, minTime, maxTime);
        if (feature) {
          layer.addData(feature);
          if (this._addlastPoint && feature.geometry.type == "LineString") {
            if (feature.geometry.coordinates.length > 0) {
              var properties = feature.properties;
              properties.last = true;
              layer.addData({
                type: 'Feature',
                properties: properties,
                geometry: {
                  type: 'Point',
                  coordinates: feature.geometry.coordinates[feature.geometry.coordinates.length - 1]
                }
              });
            }
          }
        }
      }
      
      if (this._currentLayer) {
        this._map.removeLayer(this._currentLayer);
      }
      if (layer.getLayers().length) {
        var requests = layer.getLayers().length;
        jQuery('.timecontrol-date').append(': ' + requests + ' ' + Drupal.t('Requests'));
        layer.addTo(this._map);
        this._currentLayer = layer;
      }
    }
    
  });

/**
 * Mark-a-Spot marker_leaflet.js
 *
 * Main Map-Application File with Leaflet Maps api
 *
 */

(function ($, Drupal, drupalSettings, Date) {
  
  // 'use strict';
  Drupal.Markaspot = {};
  Drupal.Markaspot.maps = [];
  var markerLayer;
  var scrolledMarker = [];
  
  Drupal.behaviors.markaspot_map = {
    
    attach: function (context, settings) {
      var map = {};
      var masSettings = settings.mas;
      
      // Make map stick to the page top or wherever, override via theme.
      var mapSelector = $('#map');
      var sticky;
      
      mapSelector.once('markaspot_map').each(function () {
        
        Drupal.Markaspot.maps[0] = L.map('map', {
          fullscreenControl: true,
          scrollWheelZoom: false,
          maxZoom: 18,
          setZoom: 16,
          center: [masSettings.center_lat, masSettings.center_lng] // starting position
        });
        
        $('#map').css('background-color:' + masSettings.map_background);
        var tileLayer = L.tileLayer(masSettings.osm_custom_tile_url);
        
        var map = Drupal.Markaspot.maps[0];
        map.addLayer(tileLayer);
        // map.dragging.disable();
        map.dragging.disable();
        
        //markerLayer = new L.featureGroup();
        markerLayer = L.markerClusterGroup({
          // disableClusteringAtZoom: 15,
          // maxClusterRadius: 120
        });
        
        map.addLayer(markerLayer);
        
        // Drupal.markaspot_map.hideMarkers();
        // Show Markers additionally ob button click.
        var categoryMarker = L.easyButton({
          position: 'topright',
          states: [
            {
              icon: 'fa-map-marker active',
              stateName: 'remove-markers',
              onClick: function (control) {
                Drupal.markaspot_map.hideMarkers();
                control.state('add-markers');
              },
              title: 'remove markers'
            }, {
              stateName: 'add-markers',
              icon: 'fa-map-marker',
              title: 'Show all Markers on the map',
              onClick: function (control) {
                Drupal.markaspot_map.showMarkers();
                control.state('remove-markers');
              }
            }]
        });
        categoryMarker.addTo(map);
        
        // Show Markers additionally ob button click.
        var timeControls = L.easyButton({
          position: 'topright',
          states: [{
            stateName: 'add-timeControls',
            icon: 'fa-clock-o',
            title: 'add random markers',
            onClick: function (control) {
              
              var timeDimensionControl = Drupal.markaspot_map.showTimeController(map);
              var geoJsonTimedLayer = Drupal.markaspot_map.createGeoJsonTimedLayer(map);
              control.state('remove-timeControls');
              
              control.timeDimensionControl = timeDimensionControl;
              map.addControl(control.timeDimensionControl);
              
              control.geoJsonTimedLayer = geoJsonTimedLayer;
              control.geoJsonTimedLayer.addTo(map);
              
            }
          }, {
            icon: 'fa-clock-o active',
            stateName: 'remove-timeControls',
            onClick: function (control) {
              
              map.removeControl(control.timeDimensionControl);
              map.removeLayer(control.geoJsonTimedLayer);
              control.state('add-timeControls');
            },
            title: 'remove markers'
          }]
        });
        timeControls.addTo(map);
  
        // Show Markers additionally ob button click.
        var heatControls = L.easyButton({
          position: 'topright',
          states: [{
            stateName: 'add-heatControls',
            icon: 'fa-tachometer',
            title: 'add random markers',
            onClick: function (control) {
        
              var timeDimensionControl = Drupal.markaspot_map.showTimeController(map);
              var geoJsonTimedLayer = Drupal.markaspot_map.createGeoJsonTimedLayer(map);
              control.state('remove-heatControls');
              control.heatMapLayer = Drupal.markaspot_map.createHeatMapLayer(map);
        
              control.heatMapLayer.addTo(map);
              console.log("Heatmap Layer added");
        
            }
          }, {
            icon: 'fa-tachometer active',
            stateName: 'remove-heatControls',
            onClick: function (control) {
              map.removeLayer(control.heatMapLayer);
              control.state('add-heatControls');
            },
            title: 'remove markers'
          }]
        });
        heatControls.addTo(map);
        
        // empty storedNids.
        localStorage.setItem("storedNids", JSON.stringify(''));
        // end once.
      
      });
      
      // Get all nids to be called via ajax(Open311).
      // jQuery.Once is not working with ajax loaded views, which means requests.json is loaded
      // twice in logged in state.
      // We check which nids are shown already and we now store nids in localStorage.
      var storedNids = JSON.parse(localStorage.getItem("storedNids"));
      var nids = Drupal.markaspot_map.getNids(masSettings.nid_selector);
      // console.log("nids jquery", nids.length);
      // console.log("stored on more", storedNids.length);
      
      if (nids.length != storedNids.length) {
        
        localStorage.setItem("storedNids", JSON.stringify(nids));
        
        markerLayer.clearLayers();
        // Load and showData on map.
        Drupal.markaspot_map.load(function (data) {
          Drupal.markaspot_map.showData(data);
          markerLayer.eachLayer(function (layer) {
            // Define marker-properties for Scrolling
            var nid = layer.options.title;
            scrolledMarker[nid] = {
              latlng: layer.getLatLng(),
              title: layer.options.title,
              color: layer.options.color
            };
          });
        }, nids);
      }
      
      
      // Theme independent selector
      var serviceRequests = $(masSettings.nid_selector);
      
      for (var i = 0, length = serviceRequests.length; i < length; i++) {
        
        // Event of hovering
        $(serviceRequests[i]).hover(function () {
          var nid = this.getAttribute('data-history-node-id');
          Drupal.markaspot_map.showCircle(scrolledMarker[nid]);
        });
        
        new Waypoint({
          element: serviceRequests[i],
          handler: function (direction) {
            
            var nid = this.element.getAttribute('data-history-node-id');
            
            var previousWp = this.previous();
            var nextWp = this.next();
            if (previousWp) {
              $(previousWp.element).removeClass('focus');
            }
            if (nextWp) {
              $(nextWp.element).removeClass('focus');
            }
            $(this.element).addClass('focus');
            
            if (scrolledMarker.hasOwnProperty(nid)) {
              Drupal.markaspot_map.showCircle(scrolledMarker[nid]);
            }
          },
          offset: '40%'
        })
      }
    }
    
  };
  
  
  Drupal.markaspot_map = {
    
    // Showing a Circle Marker on hover and scroll over
    showCircle: function (marker) {
      var map = Drupal.Markaspot.maps[0];
      
      // get zoomlevel to set circle radius
      var currentZoom = map.getZoom();
      
      var color = marker.color;
      var circle = L.circle(marker.latlng, 1600 / currentZoom, {
        color: color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.3,
        opacity: 0.7
      }).addTo(map);
      
      map.panTo(marker.latlng, {
        animate: true,
        duration: 0.5
      });
      
      // map.setView(marker.latlng, 15);
      
      setTimeout(function () {
        // marker.setIcon(icon);
        map.removeLayer(circle);
      }, 1300);
    },
    
    showTimeController: function (map) {
      // start of TimeDimension manual instantiation
      
      var timeDimension = new L.TimeDimension({
        period: drupalSettings['mas']['timeline_period']
      });
      
      // helper to share the timeDimension object between all layers
      map.timeDimension = timeDimension;
      
      // otherwise you have to set the 'timeDimension' option on all layers.
      var player = new L.TimeDimension.Player({
        transitionTime: 300,
        loop: false,
        startOver: true
      }, timeDimension);
      
      L.Control.TimeDimensionCustom = L.Control.TimeDimension.extend({
        _getDisplayDateFormat: function (date) {
          return date.format(drupalSettings['mas']['timeline_date_format']);
        },
        _onPlayerStateChange: function () {
          //console.log("_onPlayerStateChange")
        },
        _update: function () {
          // console.log(this._timeDimension);
          if (!this._timeDimension) {
            return;
          }
          var time = this._timeDimension.getCurrentTime();
          if (time > 0) {
            var date = new Date(time);
            if (this._displayDate) {
              L.DomUtil.removeClass(this._displayDate, 'loading');
              this._displayDate.innerHTML = this._getDisplayDateFormat(date);
            }
            if (this._sliderTime && !this._slidingTimeSlider) {
              this._sliderTime.setValue(this._timeDimension.getCurrentTimeIndex());
              // console.log(this._timeDimension._syncedLayers[0]._currentLayer);
              var currentLayer = this._timeDimension._syncedLayers[0]._currentLayer;
              if (currentLayer) {
                // console.log(currentLayer);
              }
            }
          } else {
            if (this._displayDate) {
              this._displayDate.innerHTML = this._getDisplayNoTimeError();
            }
          }
        },
        options: {
          player: player,
          timeDimension: timeDimension,
          position: 'bottomright',
          timeSlider: true,
          backwardButton: false,
          forwardButton: false,
          playReverseButton: false,
          displayDate: true,
          timeSliderDragUpdate: true,
          limitSliders: false,
          limitMinimumRange: 5,
          speedSlider: true,
          loopButton: true,
          minSpeed: 15,
          speedStep: 1,
          maxSpeed: 30
        }
      });
      
      return new L.Control.TimeDimensionCustom({
        playerOptions: {
          buffer: 1,
          minBufferReady: -1
        }
      });
    },
    hideTimeController: function (map) {
      
    },
    createGeoJson: function () {
      
      // Retrieve static Data.
      var data = Drupal.markaspot_static_json.getData();
      
      var feature, features;
      features = [];
      for (var i = 0; i < data.length; i++) {
        feature = {
          type: "Feature",
          properties: {time: data[i]["requested_datetime"]},
          geometry: {
            type: "Point",
            coordinates: [data[i]['long'], data[i]['lat']]
          }
        };
        features.push(feature);
      }
      return {
        type: "FeatureCollection",
        features: features
      };
    },
    
    createGeoJsonLayer: function (map) {
      
      // Create a geojson feature from static json module.
      var geoJson = Drupal.markaspot_map.createGeoJson();
      // Set bounds from geojson.
      map.fitBounds(L.geoJson(geoJson).getBounds());
  
      var currentZoom = map.getZoom();
            
      if (typeof geoJson !== 'undefined') {
        return L.geoJson(geoJson, {
          pointToLayer: function (feature, latlng) {
            var circle = L.circle(latlng, 2600 / currentZoom, {
              color: '#333',
              className: "auto_hide",
              weight: 1,
              fillColor: '#333',
              fillOpacity: 0.2
            });
            // map.panTo(latlng);
            setTimeout(function () {
              $(".auto_hide").animate({opacity: 0}, 500, function () {
                // Animation complete.
                map.removeLayer(circle);
              });
            }, 3000);
            return circle;
          }
        });
      }
    },
    
    createGeoJsonTimedLayer: function (map) {
      
      var geoJsonLayer = Drupal.markaspot_map.createGeoJsonLayer(map);
      
      // console.log(drupalSettings['mas']['timeline_period']);
      if (typeof geoJsonLayer !== 'undefined') {
        return new L.TimeDimension.Layer.MaS(geoJsonLayer, {
          updateTimeDimension: true,
          duration: drupalSettings['mas']['timeline_period']
        });
        
        /*
         return L.timeDimension.layer.geoJson(geoJsonLayer, {
         updateTimeDimension: true,
         duration: 'P1D'
         });
         */
      }
    },
    
    transformGeoJson2heat: function (geojson, intensity) {
      return geojson.features.map(function (feature) {
        return [
          feature.geometry.coordinates[1],
          feature.geometry.coordinates[0],
          intensity
        ];
      });
    },
    
    createHeatMapLayer: function () {
      
      var geoJson = Drupal.markaspot_map.createGeoJson();
      console.log("Geojson created", geoJson.length);
      var heatPoints = Drupal.markaspot_map.transformGeoJson2heat(geoJson, 4);
      console.log("heat points created");
      return new L.heatLayer(heatPoints, {
        // radius: 10,
        blur: 25,
        maxZoom: 17,
        // maxOpacity: .4
      });
  
    },
    
    /*
     * Hide Layers
     */
    hideMarkers: function () {
      Drupal.Markaspot.maps[0].closePopup();
      Drupal.Markaspot.maps[0].removeLayer(markerLayer);
    },
    
    showMarkers: function () {
      Drupal.Markaspot.maps[0].addLayer(markerLayer);
    },
    /*
     * Actions on Marker Click and Hover
     */
    markerClickFn: function (nid) {
      return function () {
        var target = document.getElementById('map');
        
        var map = Drupal.Markaspot.maps[0];
        map.closePopup();
        var report_url = Drupal.settings.basePath + 'georeport/v2/requests/' + id + '.json';
        $.getJSON(report_url).success(function (data) {
          var description = data[0].description ? data[0].description : "";
          var request = data[0].media_url ? '<img style="height: 80px; margin: 10px 10px 10px 0" src="' + data[0].media_url + '" class="map img-thumbnail pull-left"><p class="report-detail">' + description + '</p>' : '<p class="report-detail">' + description + '</p>';
          request += '<div><a class="infowindow-link" href="' + Drupal.settings.basePath + 'reports/' + id + '">' + Drupal.t('read more') + '</a></div>';
          
          L.popup({autoPanPadding: new L.Point(10, 150)})
            .setLatLng(latlon)
            .setContent(html + request + '</div>')
            .openOn(map);
          // spinner.stop();
        }).fail(function () {
          // spinner.stop();
        });
        
        map.on('popupopen', function () {
          if ($(window).width() >= 1000) {
            $('.map.img-thumbnail').popover({
              html: true,
              trigger: 'hover',
              placement: 'left',
              content: function () {
                return '<img class="img-thumbnail" style="float:right;width:320px;max-width:320px;" src="' + $(this)[0].src + '" />';
              }
            });
          }
        });
      };
    },
    getAwesomeColors: function () {
      awesomeColors = [
        {
          "color": "red", "hex": "#FF0000"
        }, {
          "color": "darkred", "hex": "#8B0000"
        }, {
          "color": "orange", "hex": "#FFA500", "iconColor": "dark-red"
        }, {
          "color": "green", "hex": "#008000"
        }, {
          "color": "darkgreen", "hex": "#006400"
        }, {
          "color": "blue", "hex": "#0000FF"
        }, {
          "color": "darkblue", "hex": "#00008B"
        }, {
          "color": "purple", "hex": "#A020F0"
        }, {
          "color": "darkpurple", "hex": "#871F78"
        }, {
          "color": "cadetblue", "hex": "#5F9EA0"
        }, {
          "color": "lightblue", "hex": "#ADD8E6", "iconColor": "#000000"
        }, {
          "color": "lightgray", "hex": "#D3D3D3", "iconColor": "#000000"
        }, {
          "color": "gray", "hex": "#808080"
        }, {
          "color": "black", "hex": "#000000"
        }, {
          "color": "beige", "hex": "#F5F5DC", "iconColor": "darkred"
        }, {
          "color": "white", "hex": "#FFFFFF", "iconColor": "#000000"
        }
      ];
      
      return awesomeColors;
    },
    /*
     * Show Data out of filtered dataset
     */
    showData: function (dataset) {
      if (dataset.status == 404) {
        //bootbox.alert(Drupal.t('No reports found for this category/status'));
        return false;
        
      }
      var statusColors = [];
      
      var awesomeColors = Drupal.markaspot_map.getAwesomeColors();
      
      $.each(dataset, function (service_requests, request) {
        
        var categoryColor = request.extended_attributes.markaspot.category_hex;
        colorswitch = categoryColor ? categoryColor.toUpperCase() : '#000000';
        
        $.each(awesomeColors, function (key, element) {
          
          if (colorswitch == element.hex) {
            var awesomeColor = element.color;
            var awesomeIcon = request.extended_attributes.markaspot.category_icon;
            var iconColor = element.iconColor ? element.iconColor : "#ffffff";
            
            icon = L.AwesomeMarkers.icon({
              icon: awesomeIcon,
              prefix: 'fa',
              markerColor: awesomeColor,
              iconColor: iconColor
            });
          }
        });
        var nid = request.extended_attributes.markaspot.nid;
        var statusColor = request.extended_attributes.markaspot.status_hex;
        var latlon = new L.LatLng(request.lat, request.long);
        var marker = new L.Marker(latlon, {
          icon: icon,
          title: nid,
          color: statusColor,
          time: request.requested_datetime
        });
        markerLayer.addLayer(marker);
      });
      var size = markerLayer.getLayers().length;
      
      if (size >= 1) {
        Drupal.Markaspot.maps[0].fitBounds(markerLayer.getBounds());
      }
      return markerLayer;
      
    },
    
    /*
     * Parse data out of static or dynamic geojson
     */
    load: function (getData, nids) {
      var url = drupalSettings.path.baseUrl;
      url = url + 'georeport/v2/requests.json?extensions=true&nids=' + nids;
      return $.getJSON(url)
        .done(function (data) {
          getData(data);
        })
        .error(function (data) {
          getData(data);
        });
    },
    
    getNids: function (selector) {
      var serviceRequests = $(selector);
      var nids = [];
      for (var i = 0, length = serviceRequests.length; i < length; i++) {
        // console.log(i);
        var element = serviceRequests[i];
        // console.log(element);
        nids.push(element.getAttribute('data-history-node-id'));
        // console.log(nids);
      }
      return nids;
    }
  }
  
})(jQuery, Drupal, drupalSettings, Date);


