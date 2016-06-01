// This is a stateless macro-level API handler for the ShareFile API.
// Adolfo Rodriguez, Keith Lindsay
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively

var fs = require('fs');
var express = require('express');
var https = require('https');
var querystring = require('querystring');
var app = express();
var files_client = require("./endpoints/sf-files");
var users_client = require("./endpoints/sf-users");
var groups_client = require("./endpoints/sf-groups");
var sfauth = require("./sf-authenticate");
var bodyParser = require('body-parser');
var crypto = require("crypto");

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

var my_options = {  // request options
    hostname: 'zzzz.sf-api.com',
    port: '443',
    path: '',
    method: 'GET',
};

app.options('*', function(request, response) {
    console.log ("-C-> OPTIONS "+request.path);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


function generateFileHash(req){
    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    var hashcode = crypto.createHash('sha1').update(current_date + random).digest('hex');
    if (req.query.hashcode){
        console.log(hashcode);
        hashcode = req.query.hashcode;
    } else {
        var json_path = __dirname + '/json/'+ hashcode +'.txt';
        var method_path = __dirname + '/method/'+ hashcode +'.txt';
        //preserve body information for after authentication                                                                             
	fs.writeFile(method_path, req.method, function(err) {
            if(err){
                return console.log(err);
            }
        });
        fs.writeFile(json_path, JSON.stringify(req.body), function(err) {
            if(err) {
                return console.log(err);
            }
        });
    }


    return hashcode;
}

function retrieveMethodWithHash(hashcode) {
     var method_path = __dirname + '/method/'+ hashcode +'.txt';
    var method_info = fs.readFileSync(method_path);
    return method_info.toString();
}

function retrieveBodyWithHash(hashcode) {
    var json_path = __dirname + '/json/'+ hashcode +'.txt';
    var json_info = fs.readFileSync(json_path);
    return json_info.toString();
}

function buildNewPath(file_array) {
    var new_path = '';
    for (var i=1; i< file_array.length; i++) {
	// console.log ("Processing element "+i+ ":" + file_array[i]);
	var replace_val = querystring.escape(querystring.unescape(file_array[i]));
	if (file_array[i] != replace_val) {
	    console.log ("Replacing " + file_array[i] + " with " + replace_val);
	    file_array[i] = replace_val;
	}
	new_path = new_path + '/'+file_array[i];
    }
    return new_path;
}

app.get('/files*', function(request, response) {
    console.log ("-C-> GET "+request.path);
    var file_array = request.path.split("/");
    var new_path = buildNewPath(file_array);
    request.path = new_path;
    console.log ("Path in: " + request.path + "  Cleaned path: " + new_path);
    
    // Note: the first element in the array should be '' since the string starts with a '/'        
    if (file_array[1] != 'files') {  // error, some funky request came in
        console.log("<-C- File not found: " + request.path);
        response.status(404);
        response.send('Not Found: ' + request.path);
        return;
    }

    sfauth.set_security (request, response, my_options, new_path, function(set_options, cookie) {
        files_client.get_file (file_array, request, response, set_options, cookie);
    });
});

app.post('/files*', function(request, response) {
    console.log ("-C-> POST "+request.path);
    var file_array = request.path.split("/");
    var new_path = buildNewPath(file_array);
    request.path = new_path;
    console.log ("Path in: " + request.path + "  Cleaned path: " + new_path);

    // Note: the first element in the array should be '' since the string starts with a '/'
    if (file_array[1] != 'files') {  // error, some funky request came in
	console.log("<-C- Destination not valid: " + request.path);
        response.status(404);
        response.send('Not Found: ' + request.path);
        return;
    }

    sfauth.set_security (request, response, my_options, new_path, function(set_options, cookie) {
        files_client.post_file (file_array, request, response, set_options, cookie);
    });
});

app.all('/*', function(req, res) {

    my_options.hashcode = generateFileHash(req);
    sfauth.set_security (req, res, my_options, req.path, function(set_options, cookie) {
        set_options.method = retrieveMethodWithHash(set_options.hashcode);
        var body = retrieveBodyWithHash(set_options.hashcode);
        if (body) {
            set_options.headers['Content-Length'] = Buffer.byteLength(body);

        }
        var url_path = '/sf/v3' + req.url;
        console.log(url_path);
        set_options.path = url_path
        console.log("<-B-: " + JSON.stringify(set_options));
        var api_request = https.request(set_options, function(api_response) {
            console.log(api_response.statusCode);
            api_response.on('data', function (d){
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(d);
            });
        });
        if (body) {
            api_request.write(body);
        }
        api_request.end();
        return;
    });
});

app.all('/*/:id', function(req, res) {
    console.log(req.body  );
    my_options.hashcode = generateFileHash(req);
    sfauth.set_security (req, res, my_options, req.path, function(set_options, cookie) {
        var id = req.params.id;
        var req_array = req.path.split("/");
        var sub_nav = "";
        if (req_array[3]) {
            sub_nav = "/" + req_array[3];
        }
        set_options.method = retrieveMethodWithHash(set_options.hashcode);
        var body = retrieveBodyWithHash(set_options.hashcode);
        console.log(JSON.parse(body));
        if (body) {
            set_options.headers['Content-Length'] = Buffer.byteLength(body);
        }
        var url_path = '/sf/v3/' + req_array[1] + '(' + id + ')' + sub_nav;
        console.log(url_path);
        set_options.path = url_path
       //set_options.hostname = set_options.headers.Host;                                                                                
        console.log("<-B-: " + JSON.stringify(set_options));

        var api_request = https.request(set_options, function(api_response) {
            console.log(api_response.statusCode);
            api_response.on('data', function (d){
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(d);
            });
        });
        if (body) {
            api_request.write(body);
        }
        api_request.end();
        return;
    });
});

app.get('/users*', function(request, response) {
    console.log ("-C-> GET "+request.path);
    var user_array = request.path.split("/");

    // Note: the first element in the array should be '' since the string starts with a '/'  
    if (user_array[1] != 'users') {  // error, some funky request came in     
        console.log("<-C- Users not found: " + request.path);
        response.status(404);
        response.send('Not Found: ' + request.path);
        return;
    }
    
    if (typeof user_array[2] !== 'undefined' && user_array[2] ) {
	var user_id = user_array[2];
	sfauth.set_security (request, response, my_options, request.path, function(set_options, cookie) {
            users_client.get_user (user_id, request, response, set_options, cookie);
	});

    } else {
	var user_type = request.query.userType;
	sfauth.set_security (request, response, my_options, request.path, function(set_options, cookie) {
            users_client.get_user_list (user_type, request, response, set_options, cookie);
	});
    }
});


app.listen(app.get('port'), function() {
    console.log("Node app is running at localhost:" + app.get('port'));
});
