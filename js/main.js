// Give the user something pretty to look at first
navigator.geolocation.getCurrentPosition(function(position) {

	var map_options = {
		zoom: 10,
		center: new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};

	var map = new google.maps.Map(document.getElementById('map'), map_options);

});

// Tell zip.js where it's files are..
zip.workerScriptsPath = 'js/';

// Set up the object Twitter uses to store it's tweets in
var Grailbird = {
	data: {}
};

var requestFileSystem = window.webkitRequestFileSystem || window.mozRequestFileSystem || window.requestFileSystem;

// Pro error handling
function onerror(message) {

	alert(message);

}

// Used to get the zip file contents. Adapted from a zip.js demo
var model = (function() {

	var URL = window.webkitURL || window.mozURL || window.URL;

	return {
		getEntries : function(file, onend) {

			zip.createReader(new zip.BlobReader(file), function(zipReader) {

				zipReader.getEntries(onend);

			}, onerror);

		}
	};

})();

var fileInput = document.getElementById('upload-input');

// Fancy hover animations when the user drags a file
fileInput.ondragover = function () { this.parentNode.className = 'hover'; return false; };
fileInput.ondragend = function () { this.parentNode.className = ''; return false; };

fileInput.addEventListener('change', function() {

	// Stop the user uploading more than one file at once
	fileInput.disabled = true;

	// Let the user know we are doing important stuffz and to be patient pls
	$('#upload-container').find('h1').text('Loading Tweets..');

	// Get all the files in the zip file
	model.getEntries(fileInput.files[0], function(entries) {

		// Just get the files we need
		entries = entries.filter(function(element) {

			return element.filename.substr(0, 15) === 'data/js/tweets/';

		});

		var entry, file_id, writer = new zip.BlobWriter(), i = 0;

		function handleFiles() {

			// Are we finished? If so, it's probably best not to break the internet and recurse forever
			if (i === entries.length) {

				// Let the user know we're done
				$('#upload-container').find('h1').text('Finished!');

				// Display dem tweets
				displayTweets();

				// Bye.
				return;

			}

			entry = entries[i];
			file_id = 'tweets_' + entry.filename.substr(15, 7);

			console.log((+new Date), 'Found File ' + i + ': ' + file_id);

			// Get the data from the file
			entry.getData(writer, function(blob) {

				// Create a blob url for the file
				var blobURL = URL.createObjectURL(blob);

				console.log((+new Date), blobURL);

				// Retrieve the contents of the blob, we do this synchronously so that we
				// can make sure not to spawn too many web workers and crash chrome..
				$.ajax({
					async: false,
					url: blobURL,
					dataType: 'text'
				}).done(function(data, status, xhr) {

					console.log((+new Date), 'XHR complete for: ' + blobURL);

					// Evaluate the Twitter script, this will append objects to Grailbird.data
					eval(data);

					// Increment the counter so we can keep track of how many files we've processed
					i++;

					// Done, next!
					handleFiles();

				});

			});

		}

		// Go, go, go!
		handleFiles();

	});

}, false);

// Used to filter and display all the tweets on a map
function displayTweets() {

	// Filter down the Grailbard mega object into just what we need.
	// And yes, I did just learn how the map/reduce/filter functions work..
	var coordinates = Object.keys(Grailbird.data).map(function(value, index) {

		return Grailbird.data[value].filter(function(value, index) {

			return typeof value.geo.coordinates != 'undefined';

		}).map(function(value, index) {

			return value.geo.coordinates;

		});

	}).reduce(function(previous, current, index, array) {

		for (var id in current) {

			previous.push(current[id]);

		}

		return previous;

	}, []);

	var heatmap_points = [],
		lat_average = 0,
		lon_average = 0;

	for (var coordinate in coordinates) {

		lat_average += coordinates[coordinate][0];
		lon_average += coordinates[coordinate][1];

		heatmap_points.push(
			new google.maps.LatLng(coordinates[coordinate][0], coordinates[coordinate][1])
		);

	}

	lat_average = lat_average / heatmap_points.length;
	lon_average = lon_average / heatmap_points.length;

	var map_options = {
		zoom: 8,
		center: new google.maps.LatLng(lat_average, lon_average),
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};

	var map = new google.maps.Map(document.getElementById('map'), map_options);

	var heatmap = new google.maps.visualization.HeatmapLayer({
		data: heatmap_points,
		dissipating: true,
		radius: 25,
		opacity: 0.6
	});

	heatmap.setMap(map);

	// Hide the overlay
	$('#upload-container').fadeOut(1000);

}