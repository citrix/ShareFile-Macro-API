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

var get_file = function(file_array, index, fileId, isFile, request, response, my_options, cookie) {
    console.log("get index: "+ index+ " array size: "+file_array.length + " isFile: " +isFile+ " fileID: " +fileId);

    if (file_array[file_array.length-1] == '') // the URL ends in a '/', just ignore the last one
	file_array.length--;
    
    if (isFile) { // we reached a file, either we return it or an error, either way we are done
	console.log ("We reached a file!");
	if (index == file_array.length-1) { // this is the end and item is a file, we should return the file itself
	    my_options.path = '/sf/v3/Items('+fileId+')/Download?includeallversions=false';
	    console.log("<-B-: " + JSON.stringify(my_options));
	    var dl_request = https.request(my_options, function(dl_response) {
		console.log("-B->: [" + dl_response.statusCode + "] : [" + JSON.stringify(dl_response.headers) + "]");
		var myurl = url.parse(dl_response.headers.location);
		file_options.hostname = myurl.hostname;
		file_options.path = myurl.path;
		console.log("<-B-: " + JSON.stringify(file_options));
		var file_request = https.request(file_options, function(file_response) {
		    console.log("-B->: [" + file_response.statusCode + "] : [" + JSON.stringify(file_response.headers) + "]");
		    response.setHeader('content-type', file_response.headers['content-type']);
		    response.setHeader('content-disposition', file_response.headers['content-disposition']);
		    
		    var file_contents = [];
		    file_response.on('data', function (chunk) {
			file_contents.push(chunk);
		    });
		    file_response.on('end', function(chunk) {
			var buffer = Buffer.concat(file_contents);
			response.send(buffer);
			response.end();
		    });
		});
		file_request.end();
	    });
	    dl_request.end();
	}
	else { // the file was referenced as if it were a folder, this is an error
	    console.log("<-C- File referenced as a folder: " + request.path);
	    response.status(404);
	    response.send('File referenced as a folder: ' + request.path);
	}
	return;   // we are done
    }
    
    // grab the next folder contents
    console.log("Still looking for the right folder");
    if (index == 1)  // fist time through, this is the home folder
	my_options.path = filepath_base + 'Items(home)' + filepath_tail;
    else
	my_options.path = filepath_base + 'Items(' + fileId + ')' + filepath_tail;
    
    console.log("<-B-: " + JSON.stringify(my_options));
    var list_request = https.request(my_options, function(list_response) {
	var resultString = '';
	list_response.on('data', function (chunk) {
	    resultString+=chunk;
	});
	list_response.on('end', function (chunk) {
	    console.log("-B->: [" + list_response.statusCode + "] : [" + JSON.stringify(list_response.headers) + "]");
	    if (!cookie) { // need to snag cookie from response and propagte back to client
		var old_cookie = list_response.headers['set-cookie'][0];
		console.log("cookie: "+old_cookie);
		var temp_cookies = old_cookie.split(";");
		var new_cookie = '';
		for (i in temp_cookies) {
		    console.log("i in temp_cookies: "+temp_cookies[i]);
		    var temp_items = temp_cookies[i].split("=");
		    console.log("yo "+temp_items[0]+ ":::" + temp_items[1]);
		    if (temp_items[0]=='SFAPI_AuthID') // carry it through
			new_cookie = new_cookie + 'Ado=' + temp_items[1];
		    else if (temp_items[0]==' domain') // rename the cookie and insert the domain one
			new_cookie = new_cookie + ":" + temp_items[1] + '; domain=adolfonc.ddns.net;';
		}
		console.log("new cookie: "+new_cookie);
		response.setHeader('set-cookie', new_cookie);
	    }
	    var list = JSON.parse(resultString).value;
	    var list_result = "\"files\":[";
	    for (i in list) {  // Repeat for every item in the folder
		if (index == file_array.length-1) { // this is the end, build the list of files (debug code)
		    list_result = list_result + "{\"Name\":\"" + list[i].Name + "\"}";
		}
		else // we need to keep looking further in the tree
		    if (list[i].Name == file_array[index+1]) { // found the next one
			console.log("We found the next one: " + list[i].Name +" count="+list[i].FileCount);
			if (list[i].FileCount)  // it's a folder
			    get_file (file_array, index+1, list[i].Id, false, request, response, my_options, cookie);
			else  // it's a file
			    get_file (file_array, index+1, list[i].Id, true, request, response, my_options, cookie);
			return;  // we are done
		    }
	    }
	    if (index == file_array.length-1) { // this is the end, just return the list of files
		list_result = list_result + "]"; // only for debug
		console.log("<-C- Folder contents returned: " + list_result);
		response.status(200);
		response.setHeader('Access-Control-Allow-Origin', '*');
		// response.send(list_result);
		response.send(list);
		return;  // we are done
	    }
	    else {  // there was more work to do but we didn't find where to go, return error
		console.log("<-C- Folder or file not found: " + request.path);
		console.log('{"code":404,"message":"Folder or file not found: ' + request.path + '","fields":" "}');
		response.status(404);
		response.setHeader('content-type', 'application/json');
		response.setHeader('Access-Control-Allow-Origin', '*');
		response.send('{"code":404,"message":"Folder or file not found: ' + request.path + '","fields":" "}');
		return;  // we are done  
	    }
	    });
    });
    list_request.end();
}

var post_file = function(file_array, index, fileId, request, response, my_options, cookie) {
    console.log("post index: "+ index+ " array size: "+file_array.length + " fileID: " +fileId);

    // grab the next folder contents
    console.log("Still looking for the right folder");
    if (index == 1)  // fist time through, this is the home folder
	fileId = 'home';
    my_options.path = filepath_base + 'Items(' + fileId + ')' + filepath_tail;
    my_options.method = 'GET';
    console.log("<-B-: " + JSON.stringify(my_options));
    
    var list_request = https.request(my_options, function(list_response) {
	var resultString = '';
	list_response.on('data', function (chunk) {
	    resultString+=chunk;
	});
	list_response.on('end', function (chunk) {
	    console.log("-B->: [" + list_response.statusCode + "] : [" + JSON.stringify(list_response.headers) + "]");
	    console.log (resultString);
	    var list = JSON.parse(resultString).value;
	    for (i in list) {  // Repeat for every item in the folder
		if (fileId == "home")  // get the actual ID for the home directory; for some reason (home) doesn't work on upload
		    fileId = list[i].Parent.Id;
		if (list[i].Name == file_array[index+1]) { // found the next one
		    console.log("We found the next one: " + list[i].Name +" count="+list[i].FileCount);
		    if (list[i].FileCount) { //its' a folder
			if (file_array.length > index+1) {  // and we aren't done
			    post_file (file_array, index+1, list[i].Id, request, response, my_options, cookie);
			    return;
			}
			else { // we are done, we can't overwrite a folder, error
			    console.log("<-C- Folder cannot be overwritten: " + request.path);
			    response.status(404);
			    response.send('Folder cannot be overwritten: ' + request.path);
			    return;
			}
		    }
		    else { // it's a file
			if (file_array.length > index+1) {  // and we aren't done   
			    console.log("<-C- File referenced as a folder: " + request.path);
			    response.status(404);
			    response.send('File referenced as a folder: ' + request.path);
			    return;
			}
			else {}  // we are done, we should upload, pretend we didn't find it
		    }
		}
	    }
	    
	    // time to upload the file
	    var file = '';
	    request.on('data', function (data) {
		file += data;
	    });
	    request.on('end', function() {
		console.log ("Received this message from client: "+file);
		my_options.path = '/sf/v3/Items('+fileId+')/Upload?method=standard&raw=1&fileName='+file_array[index+1]+'&fileSize='+file.length;
		my_options.method = 'POST';
		console.log("<-B-: "+JSON.stringify(my_options));
		var ul_request = https.request(my_options, function(ul_response) {
		    var response_data = "";
		    console.log("-B->: [" + ul_response.statusCode + "] : [" + JSON.stringify(ul_response.headers) + "]");
		    ul_response.setEncoding('utf8');
		    ul_response.on('data', function (chunk) {
			response_data = response_data + chunk;
		});
		    ul_response.on('end', function() {
			// console.log('Response: ' + response_data);
			chunkUri = JSON.parse(response_data).ChunkUri + '&raw=1&fileName='+file_array[index+1];
			console.log('Chunk URI: ' + chunkUri);
			var myurl = url.parse(chunkUri);
			sendfile_options.path = myurl.path;
			sendfile_options.hostname = myurl.hostname;
			sendfile_options.headers = {
			    'Content-Type': 'text/plain',    // It's plain-text
			    'Content-Length': file.length
			}
			console.log("<-B-: " + JSON.stringify(sendfile_options));
			var sf_request = https.request(sendfile_options, function(sf_response) {
			    console.log("-B->: [" + sf_response.statusCode + "] : [" + JSON.stringify(sf_response.headers) + "]");
			    sf_response.setEncoding('utf8');
			    sf_response.on('data', function(chunk) {
				console.log('Response: ' + chunk);
			    });
			});
			sf_request.write(file);
			sf_request.end();
		    });
		});
		
		response.status(200);
		response.send("Got it!");
		ul_request.end();
	    });
	});
    });
    list_request.end();
    
    return;
}

module.exports = {
    get_file: get_file,
    post_file: post_file
}
