//Group methods for ShareFile API
//Keith Lindsay
// Copyright ShareFile 2016

var https = require('https');
var url = require('url');

var filepath_base = '/sf/v3/';
var filepath_tail = '/Children?includeDeleted=false';   

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

var get_group = function(group_id, request, response, my_options, cookie) {
    console.log("getting group");
    my_options.path = '/sf/v3/Groups('+ group_id +')';
    console.log("<-B-: " + JSON.stringify(my_options));
    var group_request = https.get(my_options, function(group_response) {
        console.log(group_response.statusCode);
        group_response.on('data', function (d){
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.end(d);
            });


    });

    return;
}

var get_group_list = function(request, response, my_options, cookie) {
    console.log("getting all groups");
    my_options.path = '/sf/v3/Groups';
    console.log("<-B-: " + JSON.stringify(my_options));
    var group_request = https.get(my_options, function(group_response) {
        console.log(group_response.statusCode);
        group_response.on('data', function (d){
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.end(d);
            });


    });

    return;
}

var create_group = function(request, response, my_options, cookie) {
    console.log("creating group");
    var contacts = request.query.Users;
    var contact_list = "[";
    contacts.forEach(function(entry){
	   if (entry.email !== null){
	       contact_list += '{ "Email": "'+ entry.email + '"}';
	   } else if (entry.userIdentifier !== null){
	       contact_list += '{ "Id": "'+ entry.userIdentifier + '"}';
	   }
	});
    contact_list += "]";
    var group_options = {
              "Name": request.query.name,
              "IsShared": request.query.isShared,
              "Contacts": contact_list
               };

    my_options.path = '/sf/v3/Groups';
    my_options.method ="POST";
    my_options.body = JSON.stringify(group_options);
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

var update_group = function(group_id, request, response, my_options, cookie) {
    console.log("updating group");
    var group_options = {
              "Name": request.query.name,
              "IsShared": request.query.isShared,
               };
    my_options.path = '/sf/v3/Groups('+ group_id + ')';
    my_options.method ="PATCH";
    my_options.body = JSON.stringify(group_options);
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

var add_group_user = function(userId, groupId, request, response, my_options, cookie) {
    console.log("adding user to group");
    return;
}

var remove_group_user = function(userId, groupId, request, response, my_options, cookie) {
    console.log("removing user from group");
    return;
}

var delete_group = function(groupId, request, response, my_options, cookie) {
    console.log("deleting group");
    my_options.path = '/sf/v3/Groups('+ groupId +')';
    console.log("<-B-: " + JSON.stringify(my_options));
    var group_request = https.request(my_options, function(group_response) {
        console.log(group_response.statusCode);
        group_response.on('data', function (d){
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.end(d);
            });


    });
    return;
}

module.exports = {
    get_group: get_group,
    get_group_list: get_group_list,
    post_group: create_group,
    patch_group: update_group,
    delete_group: delete_group,
    add_group_user: add_group_user,
    remove_group_user: remove_group_user
}
