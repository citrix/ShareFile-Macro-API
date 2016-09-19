var https = require('https');
var url = require('url');

var file_options = {  // request options
    hostname: 'zzzz.sf-api.com',
    port: '443',
    path: '',
    method: 'GET',
};

var sendfile_options = {
    method: 'POST',
    port: '443',
};

var get_user = function(user_id, request, response, my_options, cookie) {
    console.log("get user");
    my_options.path = '/sf/v3/Users('+ user_id +')';
    console.log("<-B-: " + JSON.stringify(my_options)); 
    var user_request = https.get(my_options, function(user_response) {
	console.log(user_response.statusCode);
	user_response.on('data', function (d){
	    response.setHeader('Access-Control-Allow-Origin', '*');
	    response.end(d);
	    });


    });    
    return;
}

var get_user_list = function(user_type, request, response, my_options, cookie) {
    console.log("patch folder");
    var both = false;
    var employee_url = '/sf/v3/Accounts/Employees';
    var client_url = '/sf/v3/Accounts/Clients' ;
    if (user_type == 'employee'){
	 my_options.path = employee_url;
    } else if (user_type == 'client') {
	 my_options.path = client_url;
    } else {
	 both = true;
	 my_options.path = employee_url;
    }

    console.log("<-B-: " + JSON.stringify(my_options));
    var data;
    var user_request = https.get(my_options, function(user_response) {
        console.log(user_response.statusCode);
        user_response.on('data', function (d){
            data = d;
            if (both == true) {
                my_options.path = client_url;
		console.log("<-B-: " + JSON.stringify(my_options));
		var user_request2 = https.get(my_options, function(user_response2) {
		    console.log(user_response2.statusCode);
		        user_response2.on('data', function (d){
			    data += d;
			    response.end(data);
			});
		    

		});
	    }
       });

    });

    return;
}

var create_user = function(request, response, my_options, cookie) {
    console.log("create user");
    var user_options = {
              "Email": request.query.email,
              "FirstName": request.query.firstName,
              "LastName": request.query.lastName,
              "Company": request.query.company,
              "Password": request.query.password,
               };

    my_options.path = '/sf/v3/Users';
    my_options.method = "POST";
    my_options.body = JSON.stringify(user_options);
    console.log("<-B-: " + JSON.stringify(my_options));
    var user_request = https.request(my_options, function(user_response) {
        console.log(user_response.statusCode);
        user_response.on('data', function (d){
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.end(d);
            });
    });
    return;
}

var update_user = function(user_id, request, response, my_options, cookie) {
    console.log("update user");
    var user_options = {
              "Email": request.query.email,
              "FirstName": request.query.firstName,
              "LastName": request.query.lastName,
              "Company": request.query.company,
              "Password": request.query.password,
               };

    my_options.path = '/sf/v3/Users('+ user_id +')';
    my_options.method = "PATCH";
    my_options.body = JSON.stringify(user_options);
    console.log("<-B-: " + JSON.stringify(my_options));
    var user_request = https.request(my_options, function(user_response) {
        console.log(user_response.statusCode);
        user_response.on('data', function (d){
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.end(d);
            });
    });
    return;
}

var add_user_permissions = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

var delete_user = function(user_id, request, response, my_options, cookie) {
    console.log("delete user");
    my_options.path = '/sf/v3/Users('+ userId +')';
    my_options.method = "DELETE";
    console.log("<-B-: " + JSON.stringify(my_options));
    var user_request = https.request(my_options, function(user_response) {
        console.log(user_response.statusCode);
        user_response.on('data', function (d){
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.end(d);
            });
    });

    return;
}

var remove_user_permissions = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

module.exports = {
    get_user: get_user,
    get_user_list: get_user_list,
    post_user: create_user,
    patch_user: update_user,
    delete_user: delete_user,
    add_permissions: add_user_permissions,
    remove_permissions: remove_user_permissions
}
