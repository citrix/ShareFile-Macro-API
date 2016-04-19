// This sample application listens on a port (5000 by default) and uploads a message into a text file in the user's ShareFile file box.
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively

var express = require('express');
var https = require('https');
var url = require('url');
var auth_client = require("../auth/sf-auth");
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

var message='This is a sample message written especially for you my friend!';
var msg_len=message.length;
var fileName='sample.txt';

var upload_options = {
    hostname: 'zzzz.sf-api.com',
    port: '443',
    path: '/sf/v3/Items(box)/Upload?method=standard&raw=1&fileName='+fileName+'&fileSize='+msg_len,
    method: 'POST',
};

var sendfile_options = {
    method: 'POST',
    port: '443',
    headers: {
	'Content-Type': 'text/plain',    // It's plain-text
	'Content-Length': msg_len
    }
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
	    
	    upload_options.headers = {
		'Host': subdomain + '.sf-api.com',
		'Authorization': 'Bearer '+token
	    };
	    console.log("<-B-: " + JSON.stringify(upload_options));
	    var ul_request = https.request(upload_options, function(ul_response) {
		var response_data = "";
		console.log("-B->: [" + ul_response.statusCode + "] : [" + JSON.stringify(ul_response.headers) + "]");
		ul_response.setEncoding('utf8');
		ul_response.on('data', function (chunk) {
		    response_data = response_data + chunk;
		});
		ul_response.on('end', function() {
		    // console.log('Response: ' + response_data);
		    chunkUri = JSON.parse(response_data).ChunkUri + '&raw=1&fileName='+fileName;
		    console.log('Chunk URI: ' + chunkUri);
		    var myurl = url.parse(chunkUri);
		    sendfile_options.path = myurl.path;
		    sendfile_options.hostname = myurl.hostname;
		    console.log("<-B-: " + JSON.stringify(sendfile_options));
		    var sf_request = https.request(sendfile_options, function(sf_response) {
			console.log("-B->: [" + sf_response.statusCode + "] : [" + JSON.stringify(sf_response.headers) + "]");
			sf_response.setEncoding('utf8');
			sf_response.on('data', function(chunk) {
			    console.log('Response: ' + chunk);
			});
		    });
		    sf_request.write(message);
		    sf_request.end();
		});
	    });
	    ul_request.end();
	});
	response.send(message);
	response.end();
    }
});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});
