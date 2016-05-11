// This is the authentication handler for the ShareFile API.
// Adolfo Rodriguez, Keith Lindsay
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively

var fs = require('fs');
var https = require('https');
var os = require("os");

var test_cookie; // used only for testing
var cookie_path = '/home/azureuser/citrix/ShareFile-env/sf-cookie.js'; // used only for testing
if (fs.existsSync(cookie_path)) {
    var cookie_info = require('/home/azureuser/citrix/ShareFile-env/sf-cookie.js');  // used only for testing
    test_cookie = cookie_info.cookie_context.cookie;  // used only for testing
}

// Expects a file called 'sf-keys.js' with the following key information from ShareFile API registration:
// var key_context = {
//   client_id: "xxxxxxxxxxxx",
//   client_secret: "yyyyyyyyyyyy",
//   redirect: "http://yourredirecturlhere.com"
// }    
var key_info = require('/home/azureuser/citrix/ShareFile-env/sf-keys.js');  // API keys and developer's info
var key_context = key_info.key_context;
var client_id = key_context.client_id;
var client_secret = key_context.client_secret;
var redirect_url = key_context.redirect;

// Stuff needed to make call to exchange request code to access token
// When using code, make the posted data look like this:
// grant_type=authorization_code&code=[code]&client_id=[client_id]&client_secret=[client_secret]
var get_token_data_preamble_code = "grant_type=authorization_code&code=";

// When using username/password, make the posted data look like this:
// grant_type=password&username=[username]&password=[password]&client_id=[client_id]&client_secret=[client_secret]
var get_token_data_preamble_userpass = "grant_type=password&username=";

var get_token_options = {
    hostname: 'secure.sharefile.com',
    port: '443',
    path: '/oauth/token',
    method: 'POST',
    headers: {
	'Content-Type': 'application/x-www-form-urlencoded',
	'Content-Length': 10
    }
};

var my_options = {  // options where security credentials will be set for downstream usage by specific API calls 
    hostname: 'zzzz.sf-api.com',
    port: '443',
    path: '',
    method: 'GET',
};

var redirect = function(req, resp) {  // Redirects to ShareFile security site for user login. The security server redirects the user back here where the URI contains the request code for ShareFile
    var parameters = "https://secure.sharefile.com/oauth/authorize?response_type=code&client_id="+client_id+"&redirect_uri="+redirect_url+":5000"+req.path; 
    console.log ("<-C- Redirect to " + parameters);
    resp.redirect(parameters);
};

var authenticate = function(req, callback) { // Once the request code comes back in or we have a user/pass, this function will invoke the security server again to retrieve the access token
    var code = req.query.code;
    var username = req.query.username;
    var password = req.query.password;
    var subdomain = req.query.subdomain;
    get_token_options.hostname = subdomain+".sharefile.com";

    var get_token_data;
    if (code) {
	console.log("-C-> authenticate_code: "+ JSON.stringify(req.query));
	get_token_data = get_token_data_preamble_code + code + "&client_id=" + client_id + "&client_secret=" + client_secret;
    }
    else {
	console.log("-C-> authenticate_userpass: "+ JSON.stringify(req.query));
	get_token_data = get_token_data_preamble_userpass + username + "&password=" + password + "&client_id=" + client_id + "&client_secret=" + client_secret;
    }	
     
    console.log("Sending token get request: " + get_token_data);
    
    // ShareFile sends token data in the body, must set type and length
    get_token_options.headers = {
	'Content-Type': 'application/x-www-form-urlencoded',
	'Content-Length': get_token_data.length
    }
    // console.log("Get token options: "+ JSON.stringify(get_token_options));
    console.log("<-S- " + JSON.stringify(get_token_options) + get_token_data);
    
    var request = https.request(get_token_options, function(response) {
	var resultString = '';
	response.on('data', function (chunk) {
	    resultString+=chunk;
	});
	response.on('end', function (chunk) {
	    console.log("-S-> auth result: " + resultString);
	    callback(resultString);
	});
    });

    // Write the token data in the body
    request.write(get_token_data);
    request.end();
};

var set_security = function (request, response, my_options, callback) {
    // TODO: Deal with token and cookie expirations
    // There are several cases to consider:
    // A) First time through, there is no access code, authorization token, cookie or  username/passsword to identify the user
    // B) First time through and we have no other security cred except username and password, we can use that to get a token. This requires having the subdomain in another query string.  This is the fourth priority security cred.
    // C) Second time through, a request code exists that can be exchanged for an access token.  This is provided in a query string and the subdomain is provided in another query string.  This is the third priority security cred.
    // D) Alternatively, there is an authorization header with the access bearer token, further host header contains the subdomain. This is the second priority credential (only used if D is not present).
    // E) Lastly, there is an SFAPI_AuthID and domain cookie which is used to avoid further auth/auth checks.  This is enconded in an inbound cookie called "Ado" with the form xxxxxx:zzz.sf-api.com where xxxxxx is the ShareFile cookie and zzz is the subdomain.  The presence of this cookie overrides any other security credential received.
    
    var code = request.query.code;
    var token = '';
    var cookie = '';
    var username = request.query.username;
    var password = request.query.password;
    
    if (request.headers.cookie) {
	var temp_cookies = (request.headers.cookie).split("Ado=");
	if (temp_cookies.length == 2) {
	    var val_cookie = (temp_cookies[1]).split(':');
	    if (val_cookie.length == 2) {
		var val2_cookie = (val_cookie[1]).split('.sf-api.com');
		if (val2_cookie.length == 2) // string ends in '.sf-api.com' 
		    cookie = temp_cookies[1];
	    }
	}
	if (!cookie)
	    console.log ("Bad cookie found: "+request.headers.cookie);
    }
    else if (test_cookie) {
	console.log("Using test cookie: "+test_cookie);
	cookie = test_cookie;
    }
    
    if (request.headers['authorization']) {
	var temp = request.headers['authorization'];
	token = temp.split(" ")[1];  // token has a preface of 'Bearer: '
	console.log("Received token via header: "+token);
	console.log("Full header: "+temp);
    }
    
    if (!code && !token && !cookie && !username) {  // case A
	console.log("Case A: Initiating login sequence");
	redirect (request, response);
    }
    else {  // cases B, C, D or E
	if (cookie) {  // case E
	    console.log("Case E: Cookie found: "+cookie);
	    var temp = cookie.split(":");
	    cookie = temp[0];
	    subdomain = temp[1];
	    my_options.headers = {  // same for all invocations
		'Host': subdomain,
		'Cookie': 'SFAPI_AuthID='+cookie
	    }
	    my_options.hostname = subdomain + '.sf-api.com';	    
	    callback (my_options, cookie);
	}
	else { // case B, C or D
	    if (token) {  // case D
		var subdomain = request.headers['host'];
		console.log("Case D: Token found: "+token);
		my_options.headers = {  // same for all invocations
		    'Host': subdomain,
		    'Authorization': 'Bearer '+token
		}
		my_options.hostname = subdomain + '.sf-api.com';
		callback (my_options, cookie);
	    }
	    else {  // cases B or C
		var subdomain = request.query.subdomain;  // subdomain was selected by user when they logged in or it was passed in with user/pass
		if (code) { // case C
		    console.log("Case C: Code found: "+code);
		}
		else { // case B
		    console.log("Case B: User: " + username + " and Password: " + password);
		}
		authenticate(request, function(result) {
		    var token = JSON.parse(result).access_token;
		    var this_host = os.hostname();
		    console.log("Local hostname is " + this_host);
		    if (this_host != 'adolfo-ubuntu2') { // exclude the production server, don't save tokens there
			var token_json = "var token_context = { token: \"" + token + "\"}; exports.token_context = token_context; // This file is automatically generated by sf-authenticate.js for use by sf-client.js for testing.  It should never be checked into Github.  Confidential.";
			fs.writeFile("/home/azureuser/citrix/ShareFile-env/sf-token.js", token_json, function(err) {
			    if(err) {
				return console.log(err);
			    }
			});
		    }
		    console.log("Received token via auth flow: "+token);
		    my_options.headers = {  // same for all invocations
			'Host': subdomain + '.sf-api.com',
			'Authorization': 'Bearer '+token
		    }
		    my_options.hostname = subdomain + '.sf-api.com';
		    callback (my_options, cookie);
		});
	    }
	}
    }
}

module.exports = {
    set_security: set_security
}
