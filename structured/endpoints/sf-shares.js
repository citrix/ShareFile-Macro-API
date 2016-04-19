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

var get_share_link = function(file_array, index, fileId, isFile, request, response, my_options, cookie) {
    console.log("get folder");
    return;
}

var create_simple_send_share = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

var create_advanced_send_share = function(file_array, index, request, response, my_options, cookie) {
    console.log("create folder");
    return;
}

var update_share = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

var delete_share = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

var create_request_share = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

var get_share_info = function(file_array, index, folderId, request, response, my_options, cookie) {
    console.log("patch folder");
    return;
}

module.exports = {
    get_share_info: get_share_info,
    get_share: get_share_link,
    create_share: create_simple_send_share,
    create_advanced_share: create_advanced_send_share,
    create_request_share: create_request_share,
    update_share: update_share,
    delete_share: delete_share,
    remove_permissions: remove_user_permissions
}
