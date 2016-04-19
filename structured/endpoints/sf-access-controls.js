//Access control functions to add or remove permissions from files and folders
//Keith Lindsay
//Copyright ShareFile 2016

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

var get_access_control = function(acID, request, response, my_options, cookie) {
    //Gets access control information by ID
    console.log("get access control");
    return;
}

var create_access_control = function(acInfo, request, response, my_options, cookie) {
    //create a basic access control and assign it to a file or folder
    console.log("creating access control");
    return;
}

var update_access_control = function(acInfo, request, response, my_options, cookie) {
    //update access control
    console.log("updating access control");
    return;
}

var delete_access_control = function(acId, request, response, my_options, cookie) {
    //simple delete
    console.log("deleting access control");
    return;
}

var clone_access_control = function(originACId, itemID, request, response, my_options, cookie) {
    //takes an existing access control and creates it for a different file or folder
    console.log("cloning access control");
    return;
}

module.exports = {
    get_access_control: get_access_control,
    post_access_control : create_access_control,
    patch_access_control: update_access_control,
    delete_access_control: delete_access_control,
    clone_access_control: clone_access_control
}
