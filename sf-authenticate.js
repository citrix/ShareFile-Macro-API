// This is the authentication handler for the ShareFile API.
// Adolfo Rodriguez, Keith Lindsay
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively
//  <-X- means a message was sent to X where X={C,S,B} representing {client, security server, back-end server} respectively

var fs = require('fs');
var https = require('https');
var os = require("os");
var querystring = require("querystring");
var podioauth = require("./podio-common-authenticate");

var this_host = os.hostname();
console.log("Local hostname is " + this_host);
console.log("sf.authenticate.js start time: " + new Date().toJSON());
var env_dir = '/home/azureuser/citrix/ShareFile-env/';

var settings_path = env_dir + 'sf-settings.js';
var settings;
if (fs.existsSync(settings_path)) {
    var settings_info = require(settings_path);
    settings = settings_info.settings;
}
else {
    console.log("Missing sf-settings.js file. Exiting");
    process.exit(-1);
}

var test_cookie; // used only for testing
var cookie_path = env_dir + 'sf-cookie.js'; // used only for testing
if (fs.existsSync(cookie_path)) {
    var cookie_info = require(cookie_path);  // used only for testing
    test_cookie = cookie_info.cookie_context.cookie;  // used only for testing
}
var test_user; // used only for testing
var test_pw; // used only for testing
var test_domain; // used only for testing
var creds_path = env_dir + 'sf-creds.js'; // used only for testing (and default account in prod)

// Expects a file called 'sf-keys.js' with the following key information from ShareFile API registration:
// var key_context = {
//   client_id: "xxxxxxxxxxxx",
//   client_secret: "yyyyyyyyyyyy",
//   redirect: "http://yourredirecturlhere.com"
// }

var key_info = require(env_dir + 'sf-keys.js');  // API keys and developer's info
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

var get_RS_token_options = {
    hostname: 'secure.sharefile.com',
    port: '443',
    // the following ClientID is the production RightSignature ShareFile API (RS uses to access SF)
    path: '/sf/v3/Integrations/Jwt?targetClientId=hHemsAdC6Jg7hwKVQU9NBf1D1JBLZ6LM',
    method: 'POST'
};

var get_Podio_token_options = {
    hostname: 'secure.sharefile.com',
    port: '443',
    // the following ClientID is the production RightSignature ShareFile API (RS uses to access SF)
    path: '/sf/v3/Integrations/Code?targetClientId=xjZ93gVlcCna8B7aU7vBZcBt7DHHPhyH',
    method: 'POST'
};

//setup cache connection
var crypto = require("crypto");
var redis = require("redis");
var redis_path = env_dir + 'sf-redis.js'; // used to specify a redis server
if (fs.existsSync(redis_path)) {
    var redis_info = require(redis_path);
    console.log ("Using this Redis server: " + JSON.stringify(redis_info));
    var redclient = redis.createClient(redis_info.redis_host);
} else  //  try to connect to a local host
    var redclient = redis.createClient({port:5001});

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
	position = position || 0;
	return this.substr(position, searchString.length) === searchString;
    };
}

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
    var parameters = "https://secure.sharefile.com/oauth/authorize?response_type=code&client_id="+client_id+"&redirect_uri="+redirect_url+":"+settings.port+new_path+my_query; 
    console.log ("<-C- Redirect to " + parameters);
    resp.redirect(parameters);
};

var authenticate = function(req, callback) { // Once the request code comes back in or we have a user/pass, this function will invoke the security server again to retrieve the SF access token
    var code = req.query.code;
    var username = req.query.username;
    var password = req.query.password;
    var subdomain = req.query.subdomain;
    if (subdomain.includes(".sharefile.com") )
        get_token_options.hostname = subdomain;
    else
        get_token_options.hostname = subdomain+".sharefile.com";

    var get_token_data;
    if (code) {
	console.log("authenticate_code: "+ JSON.stringify(req.query));
	get_token_data = get_token_data_preamble_code + code + "&client_id=" + client_id + "&client_secret=" + client_secret;
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

    // Write the token data in the body of the request
    request.write(get_token_data);
    request.end();
};

var RS_get_token = function(token, subdomain, exchange_options, req, callback) { // Once the request code comes back in or we have a user/pass, this function will invoke the security server again to retrieve the RS JWT token

    console.log("Checking redis for token: "+token);
    // see if we have this token cached already
    redclient.get(token+"-RS", function(err, RS_token) {
	if (!RS_token) { // we don't have an associated token already
	    console.log("Converting SF token " + token + " to RS token");
	    get_RS_token_options.headers = {  // same for all invocations
		'Host': subdomain + '.sharefile.com',
		'Authorization': 'Bearer '+token,
		'Content-Type' : 'application/json'
	    }
	    get_RS_token_options.hostname = subdomain + '.sharefile.com';
	    console.log("<-S- " + JSON.stringify(get_RS_token_options));
    
	    var request = https.request(get_RS_token_options, function(response) {
		var resultString = '';
		response.on('data', function (chunk) {
		    resultString+=chunk;
		});
		response.on('end', function (chunk) {
		    console.log("-S-> ["+response.statusCode+"] RS auth result: " + resultString);
		    var RS_token = JSON.parse(resultString).Token;
		    redclient.set(token+"-RS", RS_token);   // remember the association between this SF
		    // token and this RS token
		    console.log("Associating this RS token: "+ RS_token + " with this SF token: " +token);
		    callback(RS_token);
		});
	    });
	    request.end();
	}	       
	else { // we have a cached RS token
	    console.log("Found this RS token: "+ RS_token + " for this SF token: " +token);
	    callback(RS_token);
	}
    });
}

var Podio_get_token = function(token, subdomain, exchange_options, req, callback) { // Once the request code comes back in or we have a user/pass, this function will invoke the security server again to retrieve the Podio code

    console.log("Checking redis for token: "+token);
    // see if we have this token cached already
    redclient.get(token+"-Podio", function(err, Podio_token) {
	if (!Podio_token) { // we don't have an associated token already
	    console.log("Converting SF token " + token + " to Podio token");
	    get_Podio_token_options.headers = {  // same for all invocations
		'Host': subdomain + '.sharefile.com',
		'Authorization': 'Bearer '+token,
		'Content-Type' : 'application/json'
	    }
	    get_Podio_token_options.hostname = subdomain + '.sharefile.com';
	    console.log("<-S- " + JSON.stringify(get_Podio_token_options));
    
	    var request = https.request(get_Podio_token_options, function(response) {
		var resultString = '';
		response.on('data', function (chunk) {
		    resultString+=chunk;
		});
		response.on('end', function (chunk) {
		    console.log("-S-> ["+response.statusCode+"] RS auth result: " + resultString);
		    var Podio_code = JSON.parse(resultString).Code;
		    var Apicp = JSON.parse(resultString).ApiCp;
		    var Appcp = JSON.parse(resultString).AppCp;
		    
		    podioauth.podio_common_authenticate(Podio_code, subdomain, Apicp, Appcp, function(result) {
			var Podio_token = JSON.parse(result).access_token;
			console.log("Received Podio token via auth flow: "+token);

			// remember the association between this SF token and Podio RS token
			redclient.set(token+"-Podio", Podio_token);   
			console.log("Associating this Podio token: "+ Podio_token + " with this SF token: " +token);
			callback(Podio_token);
		    });
		});
	    });
	    request.end();
	}	       
	else { // we have a cached Podio token
	    console.log("Found this Podio token: "+ Podio_token + " for this SF token: " +token);
	    callback(Podio_token);
	}
    });
}

var get_and_cache_tokens = function (req_type, token, subdomain, request, my_options, cookie, callback) {
    console.log("Getting RS token if needed, domain "+subdomain);
    RS_get_token (token, subdomain, my_options, request, function(RS_token) {
	console.log("Getting Podio token if needed, domain "+subdomain);
	Podio_get_token (token, subdomain, my_options, request, function(Podio_token) {
	    if (req_type == 'ShareFile') { // this is ShareFile
		my_options.headers = {  // same for all invocations
		    'Host': subdomain + '.sharefile.com',
		    'Authorization': 'Bearer '+token,
		    'Content-Type' : 'application/json'
		}
		my_options.hostname = subdomain + '.sharefile.com';
	    }
	    else if (req_type == 'RightSignature') { // this is RightSignature
		my_options.headers = {  // same for all invocations
		    'Host': 'api.rightsignature.com',
		    'Authorization': 'Bearer '+ RS_token,
		    'Content-Type' : 'application/json'
		}
		my_options.hostname = 'api.rightsignature.com';
	    }
	    else { // it's Podio
		my_options.headers = {  // same for all invocations
		    'Host': 'api.podio.com',
		    'Authorization': 'OAuth2 '+Podio_token,
		    'Content-Type' : 'application/json'
		}
		my_options.hostname = 'api.podio.com';		
	    }
	    
	    callback (my_options, cookie);
	});
    });	
}

var set_security = function (request, response, my_options, new_path, callback) {
    // TODO: Deal with token and cookie expirations

    // There are several cases to consider (in priority order):
    // S1) Cookie: There is a "Services" cloud.com cookie containing the form
    //    xxxxxx:zzz.sharefile.com:tttttt where xxxxxx is the ShareFile cookie,
    //    zzz is the subdomain, and tttttt is the SF token, which can be used to look
    //    up the RightSig and Podio tokens.  Once attained these are cached in Redis.
    // S2) There is an authorization header with the SF access bearer token, further
    //    the host header contains the subdomain. The SF token can be used to create
    //    RightSig or Podio tokens, which are cached.
    // S3) Request code: a request code exists in a query parameter that can be exchanged
    //    for a SF access token. The subdomain is provided in another query string.
    //    Once we have the SF token, we can exchange for RightSig or Podio tokens, which
    //    are cached.
    // S4) User/pass:  We have only username and password credentials in query strings which
    //    can be used to get a SF token. This also requires having the subdomain in another
    //    query string. Once we have the SF token, We exchange that for RightSig and
    //    Podio tokens, which are cached.
    // S5) Nothing: There is no access code, authorization token, cookie or
    //    username/passsword to identify the user, in this case we redirect to the webpop.
    // -------------
    // In general, we are getting RightSig and Podio tokens any time we get a SF token.  This
    // is stored in Redis with the SF token as the key.  This allows us to receover the RS
    // and Podio tokens on subsequent calls.
    
    var code = request.query.code;
    var token = '';
    var cookie = '';
    var username = request.query.username;
    var password = request.query.password;
    var RS_REQ =
	request.path.toString().startsWith ("/documents") ||
	request.path.toString().startsWith ("/reusable_templates") ||
	request.path.toString().startsWith ("/sending_requests") ||
	request.path.toString().startsWith ("/signers");
    var PODIO_REQ =
	request.path.toString().startsWith ("/podio") ||
	request.path.toString().startsWith ("/action") ||
	request.path.toString().startsWith ("/alert") ||
	request.path.toString().startsWith ("/app_stores") ||
	request.path.toString().startsWith ("/app") ||
	request.path.toString().startsWith ("/batch") ||
	request.path.toString().startsWith ("/calendar") ||
	request.path.toString().startsWith ("/conversation") ||
	request.path.toString().startsWith ("/comment") ||
	request.path.toString().startsWith ("/contact") ||
	request.path.toString().startsWith ("/mobile") ||
	request.path.toString().startsWith ("/email") ||
	request.path.toString().startsWith ("/embed") ||
	request.path.toString().startsWith ("/flow") ||
	request.path.toString().startsWith ("/form") ||
	request.path.toString().startsWith ("/friend") ||
	request.path.toString().startsWith ("/grant") ||
	request.path.toString().startsWith ("/hook") ||
	request.path.toString().startsWith ("/importer") ||
	request.path.toString().startsWith ("/integration") ||
	request.path.toString().startsWith ("/laout") ||
	request.path.toString().startsWith ("/linked_account") ||
	request.path.toString().startsWith ("/notification") ||
	request.path.toString().startsWith ("/org") ||
	request.path.toString().startsWith ("/question") ||
	request.path.toString().startsWith ("/rating") ||
	request.path.toString().startsWith ("/recurrence") ||
	request.path.toString().startsWith ("/reference") ||
	request.path.toString().startsWith ("/reminder") ||
	request.path.toString().startsWith ("/search") ||
	request.path.toString().startsWith ("/space") ||
	request.path.toString().startsWith ("/status") ||
	request.path.toString().startsWith ("/stream") ||
	request.path.toString().startsWith ("/subscription") ||
	request.path.toString().startsWith ("/tag") ||
	request.path.toString().startsWith ("/task") ||
	request.path.toString().startsWith ("/view") ||
	request.path.toString().startsWith ("/voting") ||
	request.path.toString().startsWith ("/widget");

    var req_type = 'ShareFile';
    
    if(RS_REQ) {
	console.log ("RightSignature request detected.");
	req_type = ('RightSignature');
    }
    else if (PODIO_REQ) {
	console.log ("Podio request detected.");
	req_type = ('Podio');
    }

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
	var temp_cookies = (request.headers.cookie).split("Services=");
	if (temp_cookies.length == 2) {
	    var val_cookie = (temp_cookies[1]).split(':');
	    if (val_cookie.length == 3) {
		var val2_cookie = (val_cookie[1]).split('.sharefile.com');
		if (val2_cookie.length == 2) // string ends in '.sharefile.com' 
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
	
    if (!code && !token && !cookie && !username && test_user) { // special case where nothing was passed
	// but we have a local test_user creds, this is in the common case in Prod via Swagger (which
	// uses a dummy test user account); this results in a case B flow
	request.query.username = username = test_user;
	request.query.password = password = test_pw;
	request.query.subdomain = test_domain;
	console.log ("Overriding user/pw information with local: " + username + "/" + password); 
    }
    
    if (!code && !token && !cookie && !username) { // Case S5
	console.log("Case S5: Initiating login sequence");
	redirect (request, response, new_path);
    }
    else {  // Cases S1-S4
	if (cookie) {  // Case S1 
	    console.log("Case S1: Cookie found: "+cookie+ " for this req type: "+req_type);
	    var temp = cookie.split(":");
	    cookie = temp[0];
	    subdomain = temp[1];
	    token = temp[2];

	    if (token) { // there is a token in the cookie, ensure we have RS and Podio tokens too
		get_and_cache_tokens (req_type, token, subdomain, request, my_options, cookie, function (return_options, return_cookie) {
		    if (RS_REQ || PODIO_REQ) { // RS or Podio token should already be there
		    }
		    else { // Must be ShareFile, use the cookie
			my_options.headers = {  // same for all invocations
			    'Host': subdomain,
			    'Cookie': 'SFAPI_AuthID='+cookie
			}
			my_options.hostname = subdomain;
		    }
		    callback (return_options, return_cookie, null);
		});
	    }
	}
	else { // Cases S2-S4
	    if (token) {  // Case S2
		var subdomain = request.headers['host'];
		console.log("Case S2: Token found: "+token);

		get_and_cache_tokens (req_type, token, subdomain, request, my_options, cookie, function (return_options, return_cookie) {
		    callback (return_options, return_cookie, token);
		});		    
	    }
	    else {  // Cases S3-S4
		var subdomain = request.query.subdomain;  // subdomain was selected by user when they logged in or it was passed in with user/pass
		if (code) { // Case S3
		    console.log("Case C: Code found: "+code);
		}
		else { // Case S4
		    console.log("Case B: User: " + username + " and Password: " + password);
		    if (test_user) { // If we used locally stored creds, don't send a cookie back
			cookie = 'Cookie not returned on locally used user/pass';
		    }
		}
		authenticate(request, function(result) {
		    var token = JSON.parse(result).access_token;

		    /************************ Begin dev debug *******************/
		    if (this_host != 'adolfo-ubuntu2') { // exclude the production server, don't save tokens there
			var token_json = "var token_context = { token: \"" + token + "\"}; exports.token_context = token_context; // This file is automatically generated by sf-authenticate.js for use by sf-client.js for testing.  It should never be checked into Github.  Confidential.";
			fs.writeFile(env_dir + "sf-token.js", token_json, function(err) {
			    if(err) {
				return console.log(err);
			    }
			});
		    }
		    /************************ End dev debug *******************/
		    
		    console.log("Received token via authenticate from code or user/pass flow: "+token);

		    get_and_cache_tokens (req_type, token, subdomain, request, my_options, cookie, function (return_options, return_cookie) {
			callback (return_options, return_cookie, token);
		    });		    
		});
	    }
	}
    }
}


var clear_cookie = function(response) {
    var clear_cookie = 'Services=deleted; domain=' + settings.hostname + '; path=/; expires='+Date.now();
    console.log ("Attempting to clear bad cookie by setting it to: "+clear_cookie);
    response.setHeader('set-cookie', clear_cookie);
    response.setHeader('Access-Control-Allow-Origin', '*');
}

var set_cookie = function(response, old_cookie, token) {
    console.log("cookie: "+old_cookie+", token: "+token);
    var temp_cookies = old_cookie.split(";");
    var new_cookie = '';
    for (i in temp_cookies) {
	// console.log("i in temp_cookies: "+temp_cookies[i]);
	var temp_items = temp_cookies[i].split("=");
	// console.log("here "+temp_items[0]+ ":::" + temp_items[1]);
	if (temp_items[0]=='SFAPI_AuthID') // carry it through
	    new_cookie = new_cookie + 'Services=' + temp_items[1];
	else if (temp_items[0]==' domain') {  // rename the cookie and insert the domain one
	    var temp_token = "";
	    if (token) {
		console.log ("Adding token " + token + " to the cookie.");
		temp_token = ":" + token;
	    }
	    new_cookie = new_cookie + ":" + temp_items[1] + temp_token + '; domain=' + settings.hostname + ';';
	}
	/// break cookie to test
	// new_cookie = "Services=garbage:blah.sharefile.com; domain:"+settings.hostname;
    }
    new_cookie += 'path=/;'; // apply to the whole site
    console.log("new cookie: "+new_cookie);
    response.setHeader('set-cookie', new_cookie);
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
    set_security: set_security,
    clear_cookie: clear_cookie,
    set_cookie: set_cookie
}
