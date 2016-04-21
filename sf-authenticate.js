// This is the authentication handler for the ShareFile API.
// Keith Lindsay
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively

var fs = require('fs');
var https = require('https');
var auth_client = require("./auth/sf-auth");

var my_options = {  // request options
    hostname: 'zzzz.sf-api.com',
    port: '443',
    path: '',
    method: 'GET',
};

var set_security = function (request, response, my_options, callback) {
    // TODO: Deal with token and cookie expirations
    // There are several cases to consider:
    // A) First time through, there is no access code, authorization token, or cookie to identify the use.  In this case we redirect using OAuth
    // B) Second time through, a request code exists that can be exchanged for an access token    
    // C) Alternatively, there is an authorization header with the access bearer token, further host header contains the subdomain
    // D) Lastly, there is an SFAPI_AuthID and domain cookie which is used to avoid further auth/auth checks
    
    var code = request.query.code;
    var token = '';
    var cookie = ''; 
    if (request.headers.cookie) {
	var temp_cookies = (request.headers.cookie).split("Ado="); 
	cookie = temp_cookies[1];
    }
    if (request.headers['authorization']) {
	var temp = request.headers['authorization'];
	token = temp.split(" ")[1];  // token has a preface of 'Bearer: '
	console.log("Received token via header: "+token);
	console.log("Full header: "+temp);
    }
    
    if (!code && !token && !cookie) {  // case A
	console.log("Case A: Initiating login sequence");
	auth_client.redirect (request, response);
    }
    else {  // cases B, C or D
	if (cookie) {  // case D
	    console.log("Case D: Cookie found: "+cookie);
	    var temp = cookie.split(":");
	    cookie = temp[0];
	    subdomain = temp[1];
	    my_options.headers = {  // same for all invocations
		'Host': subdomain,
		'Cookie': 'SFAPI_AuthID='+cookie
	    }
	    callback (my_options, cookie);
	}
	else { // case B or C
	    if (token) {  // case C
		var subdomain = request.headers['host'];
		console.log("Case C: Token found: "+token);
		my_options.headers = {  // same for all invocations
		    'Host': subdomain,
		    'Authorization': 'Bearer '+token
		}
		callback (my_options, cookie);
	    }
	    else {  // case B
		console.log("Case B: Code found: "+code);
		var subdomain = request.query.subdomain;  // subdomain was selected by user when they logged in
		auth_client.authenticate(request, function(result) {
		    var token = JSON.parse(result).access_token;
		    var token_json = "var token_context = { token: \"" + token + "\"} exports.token_context = token_context;";
		    fs.writeFile("sf-token.js", token_json, function(err) {
			if(err) {
			    return console.log(err);
			}
		    });
		    console.log("Received token via auth flow: "+token);
		    my_options.headers = {  // same for all invocations
			'Host': subdomain + '.sf-api.com',
			'Authorization': 'Bearer '+token
		    }
		    callback (my_options, cookie);
		});
	    }
	}
    }    
}

module.exports = {
    set_security: set_security
}
