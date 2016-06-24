// This test client invokes the ShareFile macro API.  It depends on the existence of a token file containing an authorization token in "sf-token.js".  This is is because it is impractical to redirect to an Oauth flow from a standalone node.js test client.  
// Adolfo Rodriguez
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively

var token_info = require('/home/azureuser/citrix/ShareFile-env/sf-token.js');
var token = token_info.token_context.token;
var http = require('http');
var querystring = require('querystring');

var message='{"msg":"hi"}';
var msg_len=message.length;

var post_options = {
    hostname: 'sf-macro-prod.ddns.net',
    method: 'POST',
    port: '5000',
    headers: {
	'Host': 'adolfo.sf-api.com',
	'Authorization': 'Bearer: '+token,
	'Content-Type': 'text/plain', 
	'Content-Length': msg_len
    },
    // path: '/files/'+querystring.escape('My Files & Folders')+ '/sample.txt',
    path: '/files/foadfd5d-6888-4e5a-8108-6fbae10ec22c/sample.txt',
};

var get_options = {
    hostname: 'sf-macro-prod.ddns.net',
    port: '5000',
    path: '/files/rs.txt',
    method: 'GET',
};

get_options.headers = {
    'Host': 'adolfo.sf-api.com',
    'Authorization': 'Bearer: '+token,
}

console.log("Starting client post of file using token " + token);
console.log("<-B-: " + JSON.stringify(post_options));

// put a simple file in ShareFile
var sf_request = http.request(post_options, function(sf_response) {
    console.log("-B->: [" + sf_response.statusCode + "] : [" + JSON.stringify(sf_response.headers) + "]");
    sf_response.setEncoding('utf8');
    sf_response.on('data', function(chunk) {
	    console.log('Response: ' + chunk);
    });
});
sf_request.write(message);
sf_request.end();

return;  // ignore get for now

var request = http.request(get_options, function(back_response) {
    // get a file to the console
    var resultString = '';
    back_response.on('data', function (chunk) {
        resultString+=chunk;
    });
    back_response.on('end', function (chunk) {
	console.log("-B->: [" + back_response.statusCode + "] : [" + JSON.stringify(back_response.headers) + "]");
	console.log("File contents:");
	console.log(resultString);
    });
});
request.end();
