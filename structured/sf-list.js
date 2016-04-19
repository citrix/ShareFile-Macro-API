// This sample application listens on a port (5000 by default) and builds a list of files in the home folder with download links.
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively

var express = require('express');
var https = require('https');
var auth_client = require("./auth/sf-auth");
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

var list_file_options = {
    hostname: 'zzzz.sf-api.com',
    port: '443',
    path: '/sf/v3/Items(home)/Children?includeDeleted=false',
    method: 'GET',
};

var download_options = {
    hostname: 'zzzz.sf-api.com',
    port: '443',
    path: '/sf/v3/Items(id)/Download?includeallversions=false',   // id represents the id of each item
    method: 'GET',
};

app.get('/', function(request, response) {
    console.log ("-C-> /");
    var code = request.query.code;
    if (!code) {
	console.log("Initiating login sequence");
	auth_client.redirect (request, response);
    }
    else {
	console.log("Login code found");

	var subdomain = request.query.subdomain;
	auth_client.authenticate(request, function(result) {
	    // console.log ("We got back this from authenticate: " +result);
	    
            var token = JSON.parse(result).access_token;
	    // console.log("Received token: "+token);
	    
            list_file_options.headers = {
		'Host': subdomain + '.sf-api.com',
		'Authorization': 'Bearer '+token
	    }
	    
            console.log("<-B-: " + JSON.stringify(list_file_options));
            var request = https.request(list_file_options, function(back_response) {
		var resultString = '';
		back_response.on('data', function (chunk) {
                    resultString+=chunk;
		});
		back_response.on('end', function (chunk) {
		    console.log("-B->: [" + back_response.statusCode + "] : [" + JSON.stringify(back_response.headers) + "]");
		    var list = JSON.parse(resultString).value;
		    var count = list.length;
		    var printList = '<!DOCTYPE html><html><body><h2>Files List </h2><ul id="Files">';
		    for (i in list) {  // Repeat for every item in the home folder
			download_options.headers = {
			    'Host': subdomain + '.sf-api.com',
			    'Authorization': 'Bearer '+token
			};
			(function(index) {  // This iife allows us to pass the index we are currently working on
			    download_options.path = '/sf/v3/Items('+list[index].Id+')/Download?includeallversions=false';
			    console.log("<-B-: " + JSON.stringify(download_options));
			    var dl_request = https.request(download_options, function(dl_response) {
				count = count - 1;    // Keep track of how many id's we have received
				console.log("-B->: [" + dl_response.statusCode + "] : [" + JSON.stringify(dl_response.headers) + "]");
				printList = printList + '<li><a href=\"' + dl_response.headers.location + '\">' + list[index].Name + '</a> : ' + list[index].Id + '</li>';
				if (count == 0) {  // We have received all download links, end the response and send it back
				    printList = printList + '</ul></body></html>';
				    console.log("<-C-: " + printList);
				    response.send(printList);
				    response.end();
				}
			    });
			    dl_request.end();
			})(i);
		    }
		});
            });
	    request.end();
	});
    }
});

app.listen(app.get('port'), function() {
    console.log("Node app is running at localhost:" + app.get('port'));
});
