var https = require('https');
var http = require('http');
var url = require('url');
var fs = require('fs');
var querystring = require("querystring");
var beautify = require("js-beautify").js_beautify;
var sfauth = require("../sf-authenticate");

var itempath_home = '/sf/v3/Items(home)';
var itempath_byID = '/sf/v3/Items(';
var itempath_byPath = '/sf/v3/Items/ByPath?path=';

var folderpath_tail = '/Children?includeDeleted=false'  // include all children in items call
var downloadpath_tail =')/Download?includeallversions=false';
var delete_tail=')?singleversion=false&forceSync=false';

var env_dir = '/home/azureuser/citrix/ShareFile-env/'

var settings_path = env_dir + 'sf-settings.js';
var settings;

if (fs.existsSync(settings_path)) {
    var settings_info = require(settings_path);
    settings = settings_info.settings;
}
else {
    console.log("Missing sf-settings.js file. Exiting");
    process.exit(-1);
}


var file_options = {
    hostname: 'zzzz.sf-api.com',  // this is over-written at runtime
    path: '', // this is over-written at runtime
    method: 'GET',
};

var send_message = function(response, status, message, fields, skipWrap) {
    var send_msg;
    if (!fields)
	fields = "";
    response.status(status);
    response.setHeader('content-type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (skipWrap)
	send_msg = message;
    else
	send_msg = '{"code":'+status+',"message":"'+message+'","fields":"'+fields+'"}';
    if (send_msg.length < 80)
	console.log("<-C- " + send_msg);
    else
	console.log("<-C- " +send_msg.substring(0,60) + " [Message Truncated]");
    response.send(beautify(send_msg));
    response.end();
}

var delete_file = function(file_array, new_path, request, response, my_options, cookie, token) {
    // This function does the following things:
    // 1) Finds the Item by path
    // 2) Deletes the file by ID

    // console.log("get_file array size: "+file_array.length);
    
    var item_options = my_options;
    item_options.method = 'GET';
    var possible_fileId = false;
    
    if (file_array[file_array.length-1] == '') // the URL ends in a '/'
	file_array.length--; // just ignore the last one
    
    if (file_array.length==2) { // special case to handle the home directory
	var err_msg = 'Cannot delete the home directory';
	send_message(response, 500, err_msg);
	return;
    }
    else {
	if (file_array.length==3) { // might be a file identifier, check
	    // console.log("Is this a file id? "+file_array[2]);
	    if((file_array[2].split("-")).length==5 && file_array[2].length==36) // yes, the format looks like a possible file id
		possible_fileId = true;
	}
	// remove the leading '/files' and stringify the name
	var trunc_path = querystring.escape(querystring.unescape(new_path.substring(6)));
	item_options.path = itempath_byPath + trunc_path;
    }
    console.log("<-B-: " + JSON.stringify(item_options));
    
    var item_request = https.request(item_options, function(item_response) {
	console.log("-B->: [" + item_response.statusCode + "] : [" + JSON.stringify(item_response.headers) + "]");
	
	var try_fileId = '';
	if (possible_fileId && item_response.statusCode == 404) { // this might be a file ID, try pulling it
	    try_fileId = file_array[2];
	} else if (item_response.statusCode != 200) {
	    var err_msg = 'Unrecognized internal error';
	    if (item_response.statusCode == 401) {
		if (request.headers.cookie) // a cookie was passed in
		    sfauth.clear_cookie(response);
		err_msg = 'Unauthorized access';
	    } else if (item_response.statusCode == 404) {
		err_msg = 'Folder or file not found: ' + querystring.unescape(request.path);
	    }
	    send_message(response, item_response.statusCode, err_msg);
	    return;  // we are done
	}
	
	if (!cookie) { // need to snag cookie from response and propagate back to client
	    sfauth.set_cookie(response, item_response.headers['set-cookie'][0], token);
	}
	
	var item_contents = [];

	item_response.on('data', function (chunk) {
	    item_contents.push(chunk);
	    console.log("Got some item data:" + chunk);
	});
	item_response.on('end', function (chunk) {
	    var item_buffer = Buffer.concat(item_contents);
	    console.log("Response from item complete: " +item_buffer);
	    
	    var item_id;
	    
	    if (try_fileId)
		item_id = try_fileId;
	    else {
		var item_result = JSON.parse(item_buffer);
		item_id = item_result.Id;
	    }
	    console.log("Item id is " + item_id);

	    // delete it if it's a file
	    var delete_options = my_options;
	    delete_options.method = 'DELETE';
	    if (item_id.indexOf('fo')==0) {   // it's a folder, abort
		var err_msg = 'Cannot delete folder';
		send_message(response, 500, err_msg);
		return;  // we are done                                   
	    }
	    else // it's a file
		delete_options.path = itempath_byID + item_id + delete_tail;

	    console.log("<-B-: " + JSON.stringify(delete_options));
	    var delete_request = https.request(delete_options, function(delete_response) {
		console.log("-B->: [" + delete_response.statusCode + "] : [" + JSON.stringify(delete_response.headers) + "]");
		if (delete_response.statusCode != 200 && delete_response.statusCode != 204 ) { // 204 is ok
		    var err_msg = 'Unrecognized internal error';
		    send_message(response, delete_response.statusCode, err_msg);
		    return;  // we are done
		}

		var resultString = '';
		delete_response.on('data', function (chunk) {
		    resultString+=chunk;
		});
		delete_response.on('end', function (chunk) {
		    send_message(response, 200, "File deleted");
		    return;  // we are done
		});
	    });
	    delete_request.end();
	});
    });
    item_request.end();
}


var get_file = function(file_array, new_path, request, response, my_options, cookie, token) {
    // This function does the following things:
    // 1) Finds the Item by path
    // 2) Prepares the file for download
    // 3) Downloads the file and streams it back to the client

    // console.log("get_file array size: "+file_array.length);

    var MetadataExplicit = false;
    var MatadataRequest = false;
    // console.log ("meatadata query parm: " + request.query.metadata);
    if (request.query.metadata == "true" || request.query.metadata == "1" || request.query.metadata == "True" || request.query.metadata == "TRUE") {
	console.log ("Metadata requested on.");
	MetadataExplicit = true;
	MetadataRequest = true;
    }
    else if (request.query.metadata == "false" || request.query.metadata == "0" || request.query.metadata == "False" || request.query.metadata == "FALSE") {
	console.log ("Metadata requested off.");
	MetadataExplicit = true;
	MetadataRequest = false;
    }
    
    var item_options = my_options;
    item_options.method = 'GET';
    var possible_fileId = false;
    
    if (file_array[file_array.length-1] == '') // the URL ends in a '/'
	file_array.length--; // just ignore the last one
    
    if (file_array.length==2) { // special case to handle the home directory
	item_options.path = itempath_home;
	console.log("Accessing home directory");
    }
    else {
	if (file_array.length==3) { // might be a file identifier, check
	    // console.log("Is this a file id? "+file_array[2]);
	    if((file_array[2].split("-")).length==5 && file_array[2].length==36) // yes, the format looks like a possible file id
		possible_fileId = true;
	}
	// remove the leading '/files' and stringify the name
	var trunc_path = querystring.escape(querystring.unescape(new_path.substring(6)));
	item_options.path = itempath_byPath + trunc_path;
    }
    console.log("<-B-: " + JSON.stringify(item_options));

    var item_request = https.request(item_options, function(item_response) {
	console.log("-B->: [" + item_response.statusCode + "] : [" + JSON.stringify(item_response.headers) + "]");

	var try_fileId = '';
	if (possible_fileId && item_response.statusCode == 404) { // this might be a file ID, try pulling it
	    try_fileId = file_array[2];
	} else if (item_response.statusCode != 200) {
	    var err_msg = 'Unrecognized internal error';
	    if (item_response.statusCode == 401) {
		if (request.headers.cookie) // a cookie was passed in
		    sfauth.clear_cookie(response);
		err_msg = 'Unauthorized access';
	    } else if (item_response.statusCode == 404) {
		err_msg = 'Folder or file not found: ' + querystring.unescape(request.path);
	    }
	    send_message(response, item_response.statusCode, err_msg);
	    return;  // we are done
	}

	if (!cookie) { // need to snag cookie from response and propagate back to client
	    sfauth.set_cookie(response, item_response.headers['set-cookie'][0], token);
	}
	
	var item_contents = [];
	item_response.on('data', function (chunk) {
	    item_contents.push(chunk);
	    console.log("Got some item data:" + chunk);
	});
	item_response.on('end', function (chunk) {
	    var item_buffer = Buffer.concat(item_contents);
	    console.log("Response from item complete: " +item_buffer);

	    var item_id;
	    
	    if (try_fileId)
		item_id = try_fileId;
	    else {
		var item_result = JSON.parse(item_buffer);
		item_id = item_result.Id;
	    }
	    console.log("Item id is " + item_id);

	    // Default behavior is different if we have a folder (default to return metadata) or a file (default to return contents)
	    var ReturnMetadata;
	    if (MetadataExplicit) { // They asked for something explicitly
		if (MetadataRequest)
		    ReturnMetadata = true;
		else
		    ReturnMetadata = false;
	    } else { // Nothing was specified
		if (item_id.indexOf('fo')==0)  // it's a folder
		    ReturnMetadata = true;
		else 
		    ReturnMetadata = false;
	    }
	    
	    if (ReturnMetadata) {  // Metadata will be returned
		console.log ("Returning metadata");

		// download folder metadata contents and return it
		var list_options = my_options;
		list_options.method = 'GET';
		if (item_id.indexOf('fo')==0)   // it's a folder
		    list_options.path =  itempath_byID + item_id + ")" + folderpath_tail;
		else // it's a file
		    list_options.path = itempath_byID + item_id + ")";
		
		console.log("<-B-: " + JSON.stringify(list_options));
		var list_request = https.request(list_options, function(list_response) {
		    console.log("-B->: [" + list_response.statusCode + "] : [" + JSON.stringify(list_response.headers) + "]");
		    if (list_response.statusCode != 200) {
			var err_msg = 'Unrecognized internal error';
			send_message(response, list_response.statusCode, err_msg);
			return;  // we are done
		    }
		    
		    var resultString = '';
		    list_response.on('data', function (chunk) {
			resultString+=chunk;
		    });
		    list_response.on('end', function (chunk) {
			if (item_id.indexOf('fo')==0) {  // it's a folder
			    var list = JSON.parse(resultString).value;
			    // var list_result = "\"files\":["; // for debug
			    // for (i in list) {  // for debug
			    // list_result = list_result + "{\"Name\":\"" + list[i].Name + "\"}"; // for debug
			    // } // for debug
			    // list_result = list_result + "]"; // for debug
			    console.log("Folder contents returned " + list.length + " elements");
			    // console.log(beautify(list_result));
			}
			send_message(response, 200, beautify(resultString), '', true);
			return;  // we are done
		    });
		});
		list_request.end();
	    }		    
	    else { // Will return contents
		console.log ("Returning actual data");
		var dl_options = my_options;
		dl_options.method = 'GET';
		dl_options.path = itempath_byID+item_id+downloadpath_tail;
		console.log("<-B-: " + JSON.stringify(dl_options));
		var dl_request = https.request(dl_options, function(dl_response) {
		    console.log("-B->: [" + dl_response.statusCode + "] : [" + JSON.stringify(dl_response.headers) + "]");
		    if (dl_response.statusCode != 200 && dl_response.statusCode != 302) { // redirection ok here
			var err_msg = 'Unrecognized internal error';
			send_message(response, dl_response.statusCode, err_msg);
			return;  // we are done
		    }
			
		    var myurl = url.parse(dl_response.headers.location);
		    file_options.hostname = myurl.hostname;
		    file_options.path = myurl.path;
		    console.log("<-B-: " + JSON.stringify(file_options));
		    var file_request = https.request(file_options, function(file_response) {
			console.log("-B->: [" + file_response.statusCode + "] : [" + JSON.stringify(file_response.headers) + "]");
			response.setHeader('content-type', file_response.headers['content-type']);
			response.setHeader('content-disposition', file_response.headers['content-disposition']);
			response.setHeader('Transfer-Encoding', 'chunked');
			
			// var file_contents = [];
			file_response.on('data', function (chunk) {
			    // file_contents.push(chunk);
			    response.write(chunk);
			});
			file_response.on('end', function(chunk) {
			    // var buffer = Buffer.concat(file_contents);
			    // response.send(buffer);
			    response.end();
			});
		    });
		    file_request.end();
		});
		dl_request.end();
	    }
	});
    });
    item_request.end();
}

var send_file = function(file_array, file, my_options, item_id) {
    var upload_options = my_options;
    upload_options.method = 'POST';
    upload_options.path = itempath_byID + item_id +')/Upload?method=standard&raw=1&fileName='+file_array[file_array.length-1]+'&fileSize='+file.length;
    console.log("<-B-: "+JSON.stringify(upload_options));
    var ul_request = https.request(upload_options, function(ul_response) {
	console.log("-B->: [" + ul_response.statusCode + "] : [" + JSON.stringify(ul_response.headers) + "]");
	if (ul_response.statusCode != 200) {
	    var err_msg = 'Unrecognized internal error';
	    send_message(response, list_response.statusCode, err_msg);
	    return;  // we are done
	}
	var response_data = "";
	ul_response.setEncoding('utf8');
	ul_response.on('data', function (chunk) {
	    response_data = response_data + chunk;
	});
	ul_response.on('end', function() {
	    // console.log('Response: ' + response_data);
	    chunkUri = JSON.parse(response_data).ChunkUri + '&raw=1&fileName='+file_array[file_array.length-1];
	    console.log('Chunk URI: ' + chunkUri);
	    var myurl = url.parse(chunkUri);
	    var sendfile_options = my_options;
	    sendfile_options.method = 'POST';

	    sendfile_options.path = myurl.path;
	    sendfile_options.hostname = myurl.hostname;
	    sendfile_options.headers = {
		'Content-Type': 'text/plain',    // It's plain-text
		'Content-Length': file.length
	    }
	    
	    console.log("<-B-: " + JSON.stringify(sendfile_options));
	    var sf_request = https.request(sendfile_options, function(sf_response) {
		console.log("-B->: [" + sf_response.statusCode + "] : [" + JSON.stringify(sf_response.headers) + "]");
		if (sf_response.statusCode != 200) {
		    var err_msg = 'Unrecognized internal error';
		    send_message(response, list_response.statusCode, err_msg);
		    return;  // we are done
		}
		sf_response.setEncoding('utf8');
		sf_response.on('data', function(chunk) {
		    console.log('Response: ' + chunk);
		});
	    });
	    sf_request.write(file);
	    sf_request.end();
	});
    });
    ul_request.end();
}

var post_file = function(file_array, new_path, request, response, my_options, cookie, token) {
    // This function does the following things:
    // 1) Finds the parent directory by path
    // 2) Prepares the file for upload into that parent directory
    // 3) Uploads the actual file into the parent directory

    console.log("post array size: "+file_array.length);

    var item_options = my_options;
    item_options.method = 'GET';

    var possible_fileId = false;
    var remote_url = request.query.url;
    
    if (file_array.length==4) { // might be a file identifier, check
	console.log("Is this a file id? "+file_array[2]);
	if((file_array[2].split("-")).length==5 && file_array[2].length==36) // yes, the format looks like a possible file id
	    possible_fileId = true;
    }
    
    if (file_array.length < 4) { // file has to have a name, the first element is empty, the second is 'files', and the third must be a high level folder like 'My Files & Folders'
	response.status(404);
	var err_msg = "Invalid file path.";
	send_message(response, 404, err_msg, request.path);
	return;  // we are done
    }
    
    var parent_path = '';
    for (i=1; i<file_array.length-1; i++) {
	parent_path = parent_path + "/" + file_array[i];
	// console.log("parent path so far: " + parent_path);
    }
    var trunc_path = querystring.escape(querystring.unescape(parent_path.substring(6)));
    item_options.path = itempath_byPath + trunc_path;
    item_options.method = 'GET';
    console.log("<-B-: " + JSON.stringify(item_options));
    
    var item_request = https.request(item_options, function(item_response) {
	console.log("-B->: [" + item_response.statusCode + "] : [" + JSON.stringify(item_response.headers) + "]");
	var try_fileId = '';
	if (possible_fileId && item_response.statusCode == 404) { // this might be a file ID, try pulling it
	    try_fileId = file_array[2];
	} else if (item_response.statusCode != 200) {
	    var err_msg = 'Unrecognized internal error';
	    if (item_response.statusCode == 401) {
		if (request.headers.cookie) // a cookie was passed in 
		    sfauth.clear_cookie(response);
		err_msg = 'Unauthorized access';
	    } else if (item_response.statusCode == 404) {
		err_msg = 'Folder or file not found: ' + querystring.unescape(request.path);
	    }
	    send_message(response, item_response.statusCode, err_msg);
	    return;  // we are done
	}

	if (!cookie) { // need to snag cookie from response and propagate back to client
	    sfauth.set_cookie(response, item_response.headers['set-cookie'][0], token);
	}
	
	var resultString = '';
	item_response.on('data', function (chunk) {
	    resultString+=chunk;
	});
	item_response.on('end', function (chunk) {
	    console.log (resultString);
	    var item_id;

	    if (try_fileId)
		item_id = try_fileId;
	    else {
		var item_result = JSON.parse(resultString);
		item_id = item_result.Id;
	    }
	    console.log("Item id is " + item_id);
	    
	    if (item_id.indexOf('fo')==0) { // this is a folder, we can just upload here
		console.log ("Found folder, uploading file");
		
		var file = '';
		request.on('data', function (data) {
		    file += data;
		    console.log("Got some data " + data);
		});
		request.on('end', function() {
		    if (remote_url) {  // we should ignore the posted body and just fetch contents from the remote url
			console.log("Remote url specified: "+remote_url);
			var myurl = url.parse(remote_url);
			file_options.hostname = myurl.hostname;
			file_options.path = myurl.path;
			var connection = http;
			if (myurl.protocol == 'https:') {
			    console.log("Remote URL is https");
			    connection = https;
			}
			else
			    console.log("Remote URL is http");

			console.log("<-B-: " + JSON.stringify(file_options));

			var file_request = connection.request(file_options, function(file_response) {
			    console.log("-B->: [" + file_response.statusCode + "] : [" + JSON.stringify(file_response.headers) + "]");
			    var file_contents = [];
			    file_response.on('data', function (chunk) {
				file_contents.push(chunk);
			    });
			    file_response.on('end', function(chunk) {
				var buffer = Buffer.concat(file_contents);
				file = buffer;
				if (file.length < 50) // only record it in the log if it is small
				    console.log ("Received this remote file contents: "+file);
				
				send_file(file_array, file, my_options, item_id); // send it!
				send_message(response, 200, "Got it!");
			    });
			});
			file_request.end();
		    } else {
			if (file.length < 50) // only record it in the log if it is small
			    console.log ("Received this message from client: "+file);
			else
			    console.log ("Received a file to upload but it was too long to show you");
			
			send_file(file_array, file, my_options, item_id); // send it!
			send_message(response, 200, "Got it!");
		    }
		});
	    } else {
		var err_msg = 'Referenced parent folder was a file: ' + querystring.unescape(request.path);
		send_message(response, 404, err_msg);
	    }
	});
    });
    item_request.end();
}

module.exports = {
    delete_file: delete_file,
    get_file: get_file,
    post_file: post_file
}
