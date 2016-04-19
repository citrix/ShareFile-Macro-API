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

var get_group = function(groupId, request, response, my_options, cookie) {
    console.log("getting group");
    return;
}

var get_group_list = function(request, response, my_options, cookie) {
    console.log("getting all groups");
    return;
}

var create_group = function(groupInfo, request, response, my_options, cookie) {
    console.log("creating group");
    return;
}

var update_group = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("updating group");
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
