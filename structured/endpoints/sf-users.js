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

var get_user = function(file_array, index, fileId, isFile, request, response, my_options, cookie) {
    console.log("get folder");
    return;
}

var get_users_list = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

var create_user = function(file_array, index, request, response, my_options, cookie) {
    console.log("create folder");
    return;
}

var update_user = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

var add_user_permissions = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

var delete_user = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
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
