// This is the authentication handler for the ShareFile API.
// Adolfo Rodriguez, Keith Lindsay
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively

var fs = require('fs');
var https = require('https');
var os = require("os");
var querystring = require("querystring");

var this_host = os.hostname();
console.log("Local hostname is " + this_host);
console.log("System start at time: " + new Date().toJSON());
var env_dir = '/home/azureuser/citrix/ShareFile-env/';

var settings_path = env_dir + 'podio-settings.js';
var settings;
if (fs.existsSync(settings_path)) {
    var settings_info = require(settings_path);
    settings = settings_info.settings;
}
else {
    console.log("Missing podio-settings.js file. Exiting");
    process.exit(-1);
}

var this_host = os.hostname();
console.log("Local hostname is " + this_host);

var test_cookie; // used only for testing
var cookie_path = '/home/azureuser/citrix/ShareFile-env/podio-cookie.js'; // used only for testing
if (fs.existsSync(cookie_path)) {
    var cookie_info = require(cookie_path);  // used only for testing
    test_cookie = cookie_info.cookie_context.cookie;  // used only for testing
}
var test_user; // used only for testing
var test_pw; // used only for testing
var test_domain; // used only for testing
var creds_path = '/home/azureuser/citrix/ShareFile-env/podio-creds.js'; // used only for testing (and default account in prod)


// Expects a file called 'sf-keys.js' with the following key information from ShareFile API registration:
// var key_context = {
//   client_id: "xxxxxxxxxxxx",
//   client_secret: "yyyyyyyyyyyy",
//   redirect: "http://yourredirecturlhere.com"
// }    
var key_info = require('/home/azureuser/citrix/ShareFile-env/podio-keys.js');  // API keys and developer's info
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
    hostname: 'podio.com',
    port: '443',
    path: '/oauth/token',
    method: 'POST',
    headers: {
	'Content-Type': 'application/x-www-form-urlencoded',
	'Content-Length': 10
    }
};

//setup cache connection
var crypto = require("crypto");
var redis = require("redis");
var redis_path = '/home/azureuser/citrix/ShareFile-env/sf-redis.js'; // used to specify a redis server
if (fs.existsSync(redis_path)) {
    var redis_info = require(redis_path);
    console.log ("Using this Redis server: " + JSON.stringify(redis_info));
    var redclient = redis.createClient(redis_info.redis_host);
} else  //  try to connect to a local host
    var redclient = redis.createClient({port:5001});

//var my_options = {  // options where security credentials will be set for downstream usage by specific API calls 
//    hostname: 'zzzz.sf-api.com',
 //   port: '443',
  //  path: '',
  //  method: 'GET',
//};

var redirect = function(req, resp,  new_path) {  
// Redirects to ShareFile security site for user login. The security server redirects the user back here where the URI contains the request code for ShareFile
    var my_query = '';
    var hashcode = generateCacheHash(req);
  
    if (my_query)
	my_query += '&';
    else
	my_query += '?';
    if (req.query.metadata) {
	my_query += 'metadata='+req.query.metadata;
	my_query += '&';
    }
    if (hashcode)
        my_query +='hashcode='+hashcode;	
    var parameters = "https://podio.com/oauth/authorize?client_id="+client_id+"&redirect_uri="+redirect_url+":"+settings.port+new_path+my_query; 
    console.log ("<-C- Redirect to " + parameters);
    resp.redirect(parameters);
};

var authenticate = function(req, callback) { // Once the request code comes back in or we have a user/pass, this function will invoke the security server again to retrieve the access token
    var code = req.query.code;
    var username = req.query.username;
    var password = req.query.password;
    var subdomain = req.query.subdomain;

    get_token_options.hostname = "podio.com";

    var get_token_data;
    if (code) {
	console.log("authenticate_code: "+ JSON.stringify(req.query));
	get_token_data = get_token_data_preamble_code + code + "&client_id=" + client_id + "&client_secret=" + client_secret + "&redirect_uri=" + redirect_url + ":8080" ;
    }
    else {
	console.log("authenticate_userpass: "+ JSON.stringify(req.query));
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

var set_security = function (request, response, my_options, new_path, callback) {
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

    if (fs.existsSync(creds_path)) {
	var creds_info = require(creds_path);  
	test_user = creds_info.creds_context.user; 
	test_pw = creds_info.creds_context.pw; 
	test_domain = creds_info.creds_context.domain;
    } else {
	test_user = '';
	test_pw = '';
	test_domain = '';
    }
    
    if (request.headers.cookie) {  // If there is a cookie, make sure it is valid
	var temp_cookies = (request.headers.cookie).split("Pdo=");
	if (temp_cookies.length == 2) {
	    var val_cookie = (temp_cookies[1]).split(':');
	    if (val_cookie.length == 2) {
		var val2_cookie = (val_cookie[1]).split('.podio.com');
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
	// console.log("Received token via header: "+token);
	// console.log("Full header: "+temp);
    }

    var check_local_creds = false;
    if (this_host == 'adolfo-ubuntu2') { // in, prod, only use local test user creds if coming from Swagger
	if (request.query.swagger != "yes") {
	    console.log ("We are in prod server and the swagger flag is not on");
	    test_user = '';
	}
    }
	
    if (!code && !token && !cookie && !username && test_user) { // special case where nothing was passed but we have a local test_user creds, this is in the common case in prod; this results in a case B flow
	request.query.username = username = test_user;
	request.query.password = password = test_pw;
	request.query.subdomain = test_domain;
	console.log ("Overriding user/pw information with local: " + username + "/" + password); 
    }
    
    if (!code && !token && !cookie && !username) { // case A
	console.log("Case A: Initiating login sequence");
	redirect (request, response, new_path);
    }
    else {  // cases B, C, D or E
	if (cookie) {  // case E
	    console.log("Case E: Cookie found: "+cookie);
	    var temp = cookie.split(":");
	    cookie = temp[0];
	    subdomain = temp[1];
	    my_options.headers = {  // same for all invocations
		'Host': subdomain,
		'Cookie': 'PODIOAPI_AuthID='+cookie
	    }
	    my_options.hostname = subdomain;	    
	    callback (my_options, cookie);
	}
	else { // case B, C or D
	    if (token) {  // case D
		var subdomain = request.headers['host'];
		console.log("Case D: Token found: "+token);
		my_options.headers = {  // same for all invocations
		    'Host': subdomain,
		    'Authorization': 'OAuth2 '+token
		}
		my_options.hostname = subdomain + '.podio.com';
		callback (my_options, cookie);
	    }
	    else {  // cases B or C
		var subdomain = request.query.subdomain;  // subdomain was selected by user when they logged in or it was passed in with user/pass
		if (code) { // case C
		    console.log("Case C: Code found: "+code);
		}
		else { // case B
		    console.log("Case B: User: " + username + " and Password: " + password);
		    if (test_user) { // If we used locally stored creds, don't send a cookie back
			cookie = 'Cookie not returned on locally used user/pass';
		    }
		}
		authenticate(request, function(result) {
		    var token = JSON.parse(result).access_token;
		    if (this_host != 'adolfo-ubuntu2') { // exclude the production server, don't save tokens there
			var token_json = "var token_context = { token: \"" + token + "\"}; exports.token_context = token_context; // This file is automatically generated by sf-authenticate.js for use by sf-client.js for testing.  It should never be checked into Github.  Confidential.";
			fs.writeFile("/home/azureuser/citrix/ShareFile-env/podio-token.js", token_json, function(err) {
			    if(err) {
				return console.log(err);
			    }
			});
		    }
		    console.log("Received token via auth flow: "+token);
		    my_options.headers = {  // same for all invocations
			'Host': 'api.podio.com',
			'Authorization': 'OAuth2 '+token,
			'Content-Type' : 'application/json'
		    }
		    my_options.hostname = 'api.podio.com';
		    callback (my_options, cookie);
		});
	    }
	}
    }
}

function generateCacheHash(req){
    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    var hashcode = crypto.createHash('sha1').update(current_date + random).digest('hex');
    if (req.query.hashcode){
        console.log(hashcode);
        hashcode = req.query.hashcode;
    } else {
        var json_key = hashcode +'-json';
        var method_key = hashcode +'-method';
        //preserve body information for after authentication                                                                                     
        redclient.set(method_key, req.method);
        redclient.set(json_key, JSON.stringify(req.body));
    }

    return hashcode;
}

module.exports = {
    set_security: set_security
}
