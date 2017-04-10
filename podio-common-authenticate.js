// This is the authentication handler for Podio that leverages the ShareFile user registry.
// Adolfo Rodriguez
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively
//  <-X- means a message was sent to X where X={C,S,B} representing {client, security server, back-end server} respectively

var fs = require('fs');
var https = require('https');
var os = require("os");
var this_host = os.hostname();

console.log("podio_common_authenticate.js start time: " + new Date().toJSON());
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


// Expects a file called 'podio-keys.js' with the following key information from ShareFile API registration:
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

var get_token_data_preamble_code = "{ \"locale\":\"en_US\", \"timezone\":\"America/New_York\", \"provider\":\"sharefile_limited\", \"provider_data\":{ \"code\":\"";
var get_token_data_post_code = "\", \"redirect_uri\":\"https://podio.com/sso/complete_oauth?provider=sharefile_limited\", \"scopes\":null, \"apicp\":\"";
var get_token_data_post_apicp = "\", \"appcp\":\"";
var get_token_data_post_appcp = "\", \"subdomain\":\"";

var get_token_options = {
    hostname: 'podio.com',
    port: '443',
    path: '/oauth/token',
    method: 'POST',
    headers: {
	'Content-Type': 'application/json',
	'Content-Length': 10
    }
};

var podio_common_authenticate = function(SF_code, subdomain, apicp, appcp, callback) { // Once the request code comes back in or we have a user/pass, this function will invoke the security server again to retrieve the access token
    console.log("Changing a SF code ("+SF_code+") to a Podio token.");

    get_token_options.path = "/oauth/token?client_id="+client_id+"&client_secret="+client_secret+"&grant_type=sso";
    var get_token_data;
    get_token_data = get_token_data_preamble_code + SF_code + get_token_data_post_code + apicp + get_token_data_post_apicp + appcp + get_token_data_post_appcp + subdomain + "\" } }";
     
    console.log("Sending token get request: " + get_token_data);
    
    // Token exchange sends token data in the body, must set type and length
    get_token_options.headers = {
	'Content-Type': 'application/application/json',
	'Content-Length': get_token_data.length
    }
    // console.log("Get token options: "+ JSON.stringify(get_token_options));
    console.log("<-S- " + JSON.stringify(get_token_options) + " " + get_token_data);
    
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

module.exports = {
    podio_common_authenticate:podio_common_authenticate
}
