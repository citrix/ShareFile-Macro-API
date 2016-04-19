// This is a stateless macro-level API handler for the ShareFile API.
// Adolfo Rodriguez
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively

var fs = require('fs');
var express = require('express');
var https = require('https');
var auth_client = require("./auth/sf-auth");
var app = express();
var files_client = require("./endpoints/sf-files");
var sfauth = require("./sf-authenticate");

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

var my_options = {  // request options
    hostname: 'zzzz.sf-api.com',
    port: '443',
    path: '',
    method: 'GET',
};


app.get('/files*', function(request, response) {
    console.log ("-C-> GET "+request.path);
    var file_array = request.path.split("/");
    
    // Note: the first element in the array should be '' since the string starts with a '/'
    if (file_array[1] != 'files') {  // error, some funky request came in
	console.log("<-C- File not found: " + request.path);
	response.status(404);
	response.send('Not Found: ' + request.path);
	return;
    }

    sfauth.set_security (request, response, my_options, function(set_options, cookie) {
	files_client.get_file (file_array, 1, '', false, request, response, set_options, cookie);
    });
});

app.post('/files*', function(request, response) {
    console.log ("-C-> POST "+request.path);
    var file_array = request.path.split("/");
    
    // Note: the first element in the array should be '' since the string starts with a '/'
    if (file_array[1] != 'files') {  // error, some funky request came in
	console.log("<-C- Destination not valid: " + request.path);
	response.status(404);
	response.send('Not Found: ' + request.path);
	return;
    }

    sfauth.set_security (request, response, my_options, function(set_options, cookie) {
	files_client.post_file (file_array, 1, '', request, response, set_options, cookie);
    });
});
	
app.listen(app.get('port'), function() {
    console.log("Node app is running at localhost:" + app.get('port'));
});
