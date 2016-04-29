// This is a stateless macro-level API handler for the ShareFile API.
// Adolfo Rodriguez and Keith Lindsay are awesome 
// Trace conventions:
//  -X-> means a message was received from X where X={C,S,B} representing {client, security server, back-end server} respectively

var fs = require('fs');
var express = require('express');
var https = require('https');
var auth_client = require("./auth/sf-auth");
var app = express();
var files_client = require("./endpoints/sf-files");
var users_client = require("./endpoints/sf-users");
var groups_client = require("./endpoints/sf-groups");
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
	sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            users_client.get_user (user_id, request, response, set_options, cookie);
	});

    } else {
	var user_type = request.query.userType;
	sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            users_client.get_user_list (user_type, request, response, set_options, cookie);
	});
    }
});

app.post('/users*', function(request, response){
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
        sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            users_client.create_user (user_id, request, response, set_options, cookie);
        });
  }

});

app.patch('/users*', function(request, response){
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
        sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            users_client.update_user (user_id, request, response, set_options, cookie);
        });
  }

});

app.delete('/users*', function(request, response){
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
        sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            users_client.delete_user (user_id, request, response, set_options, cookie);
        });

    }
});

app.get('/groups*', function(request, response){
    var group_array = request.path.split("/");

    // Note: the first element in the array should be '' since the string starts with a '/'                                                         
    if (group_array[1] != 'groups') {  // error, some funky request came in                                                                         
        console.log("<-C- Groups not found: " + request.path);
        response.status(404);
        response.send('Not Found: ' + request.path);
        return;
    }

  if (typeof group_array[2] !== 'undefined' && group_array[2] ) {
      var group_id = group_array[2];
        sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            groups_client.get_group(group_id, request, response, set_options, cookie);
        });
  } else {
        sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            groups_client.get_group_list(request, response, set_options, cookie);
        });

  }
});

app.post('/groups*', function(request, response){
    var group_array = request.path.split("/");

    // Note: the first element in the array should be '' since the string starts with a '/'                                                         
    if (group_array[1] != 'groups') {  // error, some funky request came in                                                                         
        console.log("<-C- Groups not found: " + request.path);
        response.status(404);
        response.send('Not Found: ' + request.path);
        return;
    }
        sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            groups_client.create_group(request, response, set_options, cookie);
        });
  
});

app.patch('/groups*', function(request, response){
    var group_array = request.path.split("/");

    // Note: the first element in the array should be '' since the string starts with a '/'                                           
    if (group_array[1] != 'groups') {  // error, some funky request came in                                                     
        console.log("<-C- Groups not found: " + request.path);
        response.status(404);
        response.send('Not Found: ' + request.path);
        return;
    }

  if (typeof group_array[2] !== 'undefined' && group_array[2] ) {
      var group_id = group_array[2];
        sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            groups_client.update_group(group_id, request, response, set_options, cookie);
        });
  }

});

app.delete('/groups*', function(request, response){
    var group_array = request.path.split("/");

    // Note: the first element in the array should be '' since the string starts with a '/'  
    if (group_array[1] != 'groups') {  // error, some funky request came in          
        console.log("<-C- Groups not found: " + request.path);
        response.status(404);
        response.send('Not Found: ' + request.path);
        return;
    }

  if (typeof group_array[2] !== 'undefined' && group_array[2] ) {
      var group_id = group_array[2];
        sfauth.set_security (request, response, my_options, function(set_options, cookie) {
            groups_client.delete_group(group_id, request, response, set_options, cookie);
        });
  }
});

app.listen(app.get('port'), function() {
    console.log("Node app is running at localhost:" + app.get('port'));
});
