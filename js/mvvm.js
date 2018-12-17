var Marker = function(data){
	/*
		Marker model, consisting of: 
		observable array for photos, 
		observables for title, latLng, photosHeading, photosError text, map marker. 
		and an info window
	*/
	var self = this;
	this.fsqPhotos = ko.observableArray([]);
	this.title = ko.observable(data.title);
	this.photosHeading = ko.observable();
	this.photosHeading = this.title() + " Photos:";
	this.photosError = ko.observable();
	this.latLng = ko.observable(data.latLng);
	this.marker = null;
	this.infoWindow = null;

	// hide the marker:
	this.hideMarker = function(){
		if(!map){
			return;
		}
		// if marker doesn't exist, exit:
		if(!self.marker){
			return;
		}
		self.marker.setMap(null);
	}

	// configure and show the marker 
	this.showMarker = function(){
		if(!map){
			return;
		}
		self.marker = new google.maps.Marker({
			animation: google.maps.Animation.DROP,
			position: self.latLng(),
			map: map, 
			title: self.title()
		});
		self.marker.addListener('click', function(){
			self.showInfoWindow();
			toggleBounce(this);
		});
		self.populatePhotos();
	}

	// populate photos observable array with photos from foursquare API response
	this.populatePhotos = function(){
		self.fsqPhotos.removeAll();
		// construct API call, factoring-in my foursquare app ID and location ID:
		var endpointUrl = "https://api.foursquare.com/v2/venues/"+data.fsqID+"/photos?client_id=ISJXFUOWDQL40U0TUZILR3MQGOFVV0DGWXSW021RPNJKZDVI&client_secret=HLSIXUYK24Q5FS0WK4XKVTGKBQAX5ID0XWLJICMVPRWXJCPZ&v=20180829";
		// Async call to foursquare API:
		$.ajax({
			dataType: "jsonp",
			url: endpointUrl,
			// if successful, add to fsqPhotos obseravbleArray each photo item in the response's photos array:
			success: function(result){
				if(result.response.photos.items.length > 0){
					for(var i=0; i<result.response.photos.items.length; i++){					
						self.fsqPhotos.push(new Photo(result.response.photos.items[i]));
					}
				}
				// if length of response's photos array is 0, indicate to the user there were no photos found:
				else{
					self.photosError = "no Photos found";
				}
			},
			// if async call failed, indicate to the user there was an issue pulling from the foursquare API:
			fail: function(result){
				self.photosError = "Couldn't connect to Foursquare.";
			}
		});
	};

	// close the info window: 
	this.closeInfoWindow = function(){
		// clear existing info window first:
		if(currMapInfoWindow){
			currMapInfoWindow.close();
		}
		// if model's infowindow exists, close:
		if(self.infoWindow){
			self.infoWindow.close();
		}
	};

	// show the info window:
	this.showInfoWindow = function(){
		if(!map){
			return;
		}

		this.closeInfoWindow();

		self.infoWindow = new google.maps.InfoWindow();

		if(self.infoWindow.marker != self.marker){
			self.infoWindow.marker = self.marker;
			self.infoWindow.setContent('<div>' + self.title() + '</div>');
			self.infoWindow.open(map, self.marker);		
			// adding closeclick listener to google maps marker object for when user closes marker via map ui:	
			self.infoWindow.addListener('closeclick',function(){
				// per stackoverflow question 2946165 reply, Google Maps api v3+ has .close() function:
				self.infoWindow.close();
			}); 
			// set current info window to this one:
			currMapInfoWindow = self.infoWindow;
		}
	};
}


var Photo = function(data){
	/*  
		Photo model consisting of foursquare api setting specifying size 
	 	and the photo's img src url constructed from data passed to the model 
	 	via the foursquare api response's photos array:
	*/
	var self = this;
	this.photoSize = "cap150";
	this.photoSrc = data.prefix + this.photoSize + data.suffix;
}


var MarkerGroup = function(group){
	/*
		MarkerGroup model consisting of a title, observableArray of markers, 
		and a current marker observable
	*/
	var self = this;
	this.name = group.name;
	this.markers = group.markers;
	self.group = group;
	this.markerList = ko.observableArray([]);

	this.populateMarkerList = function(markerGroup){
		self.markerList.removeAll();
		markerGroup.markers.forEach(function(marker){
			self.markerList.push(new Marker(marker));
		});
	}

	// populate markerList initially with daily items:
	this.populateMarkerList(group);

	// set initial currentMarker to item 0 of marker list:
	this.currentMarker = ko.observable(this.markerList()[0]);

	this.setCurrentMarker = function(marker){
		self.currentMarker(marker);
		self.currentMarker().showInfoWindow();
	};

}


var ViewModel = function(){
	/*
		ViewModel ties the models together.  Contains markerGroup observableArray, 
		a current group observable, and functions to display the markers for the 
		current group in the DOM and in the Google Map.
	*/
	var self = this;
	this.markerGroups = ko.observableArray([]);
	this.currGroup = ko.observable();

	// populate marker groups observableArray with supplied array of groups:
	this.populateMarkerGroups = function(groups){
		self.markerGroups.removeAll();
		groups.forEach(function(group){
			self.markerGroups.push(new MarkerGroup(group));
		});
	}
	// send the markerData JSON to the populateMarkerGroups function:
	this.populateMarkerGroups(markerData);

	this.clearMarkers = function(){
		if(!map){
			return;
		}

		for(var i = 0; i<self.markerGroups().length; i++){
			for(var j = 0; j<self.markerGroups()[i].markerList().length; j++){
				self.markerGroups()[i].markerList()[j].hideMarker();
			}
		}
	}

	// show ALL markers from ALL groups in the markerGroups observableArray:
	this.showAllMarkers = function(){
		if(!map){
			return;
		}

		for(var i = 0; i<self.markerGroups().length; i++){
			for(var j = 0; j<self.markerGroups()[i].markerList().length; j++){
				self.markerGroups()[i].markerList()[j].showMarker();
			}
		}
	}

	// show markers for CURRENT group:
	this.showMarkers = function(){
		if(!map){
			return;
		}

		// if defaultMarkers are present, clear them:
		if(defaultMarkers.length > 0){
			clearDefaultMarkers();
		}

		// if user selects placeholder, currGroup will be undefined, so exit:
		if(!self.currGroup()){
			self.clearMarkers();
			self.showAllMarkers();
			return;
		}

		// clear all markers first:
		self.clearMarkers();

		for(var j = 0; j<self.currGroup().markerList().length; j++){
			self.currGroup().markerList()[j].showMarker();
		}

	}
}

// initialize ko by passing the ViewModel to applyBindings ko function:
ko.applyBindings(new ViewModel());