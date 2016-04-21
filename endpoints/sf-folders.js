//Folder Queries for macro API
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

var get_folder = function(file_array, index, fileId, isFile, request, response, my_options, cookie) {
    //Simple get for a folder by id or by name - this will be identical to get file
    console.log("get folder");
    return;
}

var get_folder_structure = function(file_array, index, folderId, request, response, my_options, cookie) {
    //Recursively trace through Folder structure and return nested JSON structure
    console.log("get folder structure");
    return;
}

var create_folder = function(file_array, index, request, response, my_options, cookie) {
    //Creates a folder
    console.log("create folder");
    return;
}

var update_folder = function(file_array, index, folderId, request, response, my_options, cookie) {
    //Update folder information such as name
    console.log("patch folder");
    return;
}

var delete_folder = function(file_array, index, folderId, request, response, my_options, cookie) {
    //Delete folder
    console.log("patch folder");
    return;
}

var move_folder = function(folderInfo, newParentInfo, request, response, my_options, cookie) {
    //moves folder by updating parent                                                                                                                     
    console.log("move folder");
    return;
}

var find_folder = function(folderInfo, request, response, my_options, cookie){
    //simple search for folder - folderInfo can contain either name or id
    console.log("find folder");
    return;
}

var id_from_name = function (folderName, request, response, cookie){
    //helper function that gets a folder id from a name or path
    console.log("Attempting to find folder");
    return;
}

module.exports = {
    get_folder: get_folder,
    get_folder_structure: get_folder_structure,
    post_folder: create_folder,
    patch_folder: update_folder,
    delete_folder: delete_folder,
    move_folder: move_folder,
    find_folder: find_folder

}
