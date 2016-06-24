var https = require('https');
var url = require('url');
var querystring = require("querystring");
var beautify = require("js-beautify").js_beautify;
var fs = require('fs');
var redis = require("redis");
var redis_path = '/home/azureuser/citrix/ShareFile-env/sf-redis.js'; // used to specify a redis server                                                      
if (fs.existsSync(redis_path)) {
    var redis_info = require(redis_path);
    console.log ("Using this Redis server: " + JSON.stringify(redis_info));
    var redclient = redis.createClient(redis_info.redis_host);
} else  //  try to connect to a local host                                                                                        
    var redclient = redis.createClient({port:5001});

var stream_options = {
    hostname: 'zzzz.sf-api.com',  // this is over-written at runtime
    port: '443',
    path: '', // this is over-written at runtime
    method: 'GET',
};

var create_stream = function(file_array, new_path, request, response, my_options, cookie) {
    //creates a temp file and stores it in sharefile
    //creates a redis object with the same id as the file
    console.log(file_array);
    var parent_id = "foa42c71-cd4d-4b3a-a496-f900f889d4fe";
    var tmp_file = ["test"];
    var file = Buffer.concat(tmp_file);
    send_file(file_array, file, my_options, parent_id, function(file_info){
	console.log(file_info);
	file_parse = JSON.parse(file_info);
	file_id = file_parse.value[0].id;
	console.log("ID: " + file_id);
	var file_json = {
	    "file_path": new_path,
	    "parent_id": parent_id,
	    "data" : file
	    }
	var file_string = JSON.stringify(file_json);
	redclient.set(file_id, file_string);
	send_message(response, '200', 'Success', 'StreamID:' +  file_id);
	//(response, status, message, fields, skipWrap) {
    });
}

var get_stream = function(id, path, request, response, my_options, cookie ) {
    //pulls file from sharefile and loads into redis if it's not already there
    if(redclient.exists(id, function(err, reply){
	if (reply === 1) {
	   //file already loaded just return
	} else {
	    fetch_file(id, my_options, function(file_info){
		var file_json = {
		    "file_path": path,
		    "parent_id": file_info.parent_id,
		    "data" : file_info.file_data
		}
		redclient.set(file_info.Id, file_json);
	    });
	}
    }));
}

var update_stream = function(id, path, request, response, my_options, cookie ) {
    //adds data to redis 
    redclient.get(id, function (err, file_info){
	file_json = JSON.parse(file_info);
	var file_contents = file_json.data.split(",");
	console.log(request.body.data);
	console.log(file_contents);
	file_contents.push(request.body.data);
	line_number = file_contents.length -1;
	file_json.data = file_contents.toString();
	file_info = JSON.stringify(file_json);
	redclient.set(id, file_info);
	send_message(response, '200', 'Success', 'LineNumber:'+line_number);
    });
}

var save_stream = function(id, path, request, response, my_options, cookie ) {
    //stores stream information to sharefile
    redclient.get(id, function (err, file_info){
	file_json = JSON.parse(file_info);
	var parent_id = file_json.parent_id;
	console.log(parent_id);
	//file_data_array = file_json.data.split(",");
	var buffer = new Buffer(file_json.data, "utf8");
	file = buffer;
	var file_array = file_json.file_path.split("/");
	send_file(file_array, file, my_options, parent_id, function(file_info) {
	    console.log(file_info);
	    //once we have saved the file, we remove it from memory
	    redclient.del(id, function(err, reply){
		console.log(reply);
	    });
	});
    });
}

var delete_stream = function(id, path, request, response, my_options, cookie ) {
    //deletes stream and file from sharefile
    redclient.del(id, function(err,reply){
	console.log(reply);
    });
}

var send_file = function(file_array, file, my_options, parent_id, callback) {
    var upload_options = my_options;
    upload_options.method = 'POST';
    upload_options.path =  '/sf/v3/Items(' + parent_id +')/Upload?method=standard&raw=1&fileName='+file_array[file_array.length-1]+'&fileSize='+file.length;
    console.log("<-B-: "+JSON.stringify(upload_options));
    var ul_request = https.request(upload_options, function(ul_response) {
        console.log("-B->: [" + ul_response.statusCode + "] : [" + JSON.stringify(ul_response.headers) + "]");
        if (ul_response.statusCode != 200) {
            var err_msg = 'Unrecognized internal error';
            //send_message(response, list_response.statusCode, err_msg);
            return;  // we are done                                                                                                                        
        }
        var response_data = "";
        ul_response.setEncoding('utf8');
        ul_response.on('data', function (chunk) {
            response_data = response_data + chunk;
        });
        ul_response.on('end', function() {
            // console.log('Response: ' + response_data);                                                                                                   
            chunkUri = JSON.parse(response_data).ChunkUri + '&raw=1&fmt=json&fileName='+file_array[file_array.length-1];
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
		    callback(chunk);
                });
            });
            sf_request.write(file);
            sf_request.end();
        });
    });
    ul_request.end();
}

function fetch_file (item_id, my_options) {

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
	    
            var file_contents = [];                                                                                                          
            file_response.on('data', function (chunk) {
                file_contents.push(chunk);                                                                                                   
                //response.write(chunk);
            });
            file_response.on('end', function(chunk) {
                //var buffer = Buffer.concat(file_contents);                                                                                   
                // response.send(buffer);                                                                                                       
                //response.end();
		return file_contents;
            });
        });
        file_request.end();
    });
    dl_request.end();

}

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

module.exports = {
    delete_stream: delete_stream,
    get_stream: get_stream,
    create_stream: create_stream,
    update_stream: update_stream,
    save_stream: save_stream
}
