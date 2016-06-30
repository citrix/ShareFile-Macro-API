var https = require('https');
var url = require('url');
var querystring = require("querystring");
var beautify = require("js-beautify").js_beautify;
var fs = require('fs');
var redis = require("redis");
var redis_path = '/home/azureuser/citrix/ShareFile-env/sf-redis.js'; // used to specify a redis server              
var crypto = require("crypto");   
if (fs.existsSync(redis_path)) {
    var redis_info = require(redis_path);
    console.log ("Using this Redis server: " + JSON.stringify(redis_info));
    var redclient = redis.createClient(redis_info.redis_host);
} else  //  try to connect to a local host                                                                                        
    var redclient = redis.createClient({port:5001});


var get_subdomain_id = function(options, callback){
    var domain = options.hostname;
    var domain_array = domain.split(".");
    var subdomain = domain_array[0];
    console.log("Subdomain :" + subdomain);
  
    if(redclient.exists(subdomain, function(err, reply){
        if (reply === 1) {
            // already a key for the subdomain just return                                                            
            redclient.get(subdomain, function (err, subdomain_id){
		console.log(subdomain_id);
		callback(subdomain_id);
	    });
        } else {
	    var current_date = (new Date()).valueOf().toString();
	    var random = Math.random().toString();
	    var hashcode = crypto.createHash('sha1').update(current_date + random).digest('hex');
	    redclient.set(subdomain, hashcode);
	    callback(hashcode);
    }}));
    
}

var create_object= function(entity_name, request, response, options) {
    //creates a redis json table based on generic entity name
 try {
    console.log(options.hostname);
    var body_json = request.body;
    console.log(body_json);
    var object_string = JSON.stringify(body_json);
    get_subdomain_id(options, function(subdomain_id){
	var key = subdomain_id +":"+ entity_name;
	console.log(key);
	redclient.rpush(key, object_string, function(err, object_count) {
	    if ((err) || (!object_count)) {
		send_message(response, '500', 'There was an error with your request');
	    } else {
		console.log(object_count); //prints 2
		var object_id = object_count - 1;
		var entity_total = "Total " + entity_name;
		var entity_id = entity_name + " Id";
		var output_json = { "Object Name" : entity_name, "Total Objects" : object_count, "Object Id": object_id };   
		var output_string = JSON.stringify(output_json);    
		send_message(response, '200', 'Success', output_string);
	    }
	});
    });
  } catch (err) {
      send_message(response, '500', 'There was an error with your request');
  }
}

var get_object = function(id, entity, request, response, options ) {
    //pulls file from sharefile and loads into redis if it's not already there
 try {
    get_subdomain_id(options, function(subdomain_id){
	var key = subdomain_id +":"+ entity;
	console.log(key);
	redclient.lindex(key, id, function(err, object_string) {
	    if ((err) || (!object_string))  {
		send_message(response, '500', 'There was an error with your request');
	    } else {
		console.log(object_string); //prints 2                
		send_message(response, '200', 'Success', object_string);
	    }
	});
    });
 } catch (err){
      send_message(response, '500', 'There was an error with your request');
  }

}

var update_object = function(id, entity, request, response, options) {
    //adds data to redis 
  try {
    get_subdomain_id(options, function(subdomain_id){
	var key = subdomain_id +":"+ entity;
	redclient.lindex(key, id, function (err, object_string){
	    if ((err) || (!object_string)){
		send_message(response, '500', 'There was an error with your request');
	    } else {
		object_json = JSON.parse(object_string);
		request_json = request.body;
		console.log(request.body);
		for(var i in request_json){
		    var cur_key = i;
		    var val = request_json[i];
		    console.log(val);
		    object_json[cur_key] = val;
		}
		object_info = JSON.stringify(object_json);
		redclient.lset(key, id, object_info, function(err, reply) {
		    console.log(reply);
		    send_message(response, '200', 'Success', reply);
		});
	    }
	});
    });
  } catch (err){
      send_message(response, '500', 'Error', err);
  }
}


var delete_object = function(id, entity, request, response, options) {
    //deletes stream and file from sharefile
  try {
    get_subdomain_id(options, function(subdomain_id){
	var key = subdomain_id +":"+ entity;
	redclient.lset(key, id, "DELETED", function(err,reply){
	    console.log(reply);
	    send_message(response, '200', 'Success');
	});
    });
  } catch (err){
      send_message(response, '500', 'Error', err);
  }
}

var get_property = function(id, entity, property, request, response, options) {
    //adds data to redis                                                                                               
  try {
    get_subdomain_id(options, function(subdomain_id){
	var key = subdomain_id +":"+ entity;
	redclient.lindex(key, id, function (err, object_string){
	    if ((err) || (!object_string)){
		send_message(response, '500', 'There was an error with your request');
	    } else {
		object_json = JSON.parse(object_string);
		var property_json = object_json[property];
		console.log(property_json);
		send_message(response, '200', 'Success', JSON.stringify(property_json));
	    }
	});
    });
  } catch (err){
      send_message(response, '500', 'Error', err);
  }
}

var create_property = function(id, entity, property, request, response, options) {
    //adds data to redis                                                                                               
   try {
    get_subdomain_id(options, function(subdomain_id){
	var key = subdomain_id +":"+ entity;
	redclient.lindex(key, id, function (err, object_string){
	    if ((err) || (!object_string)) {
		send_message(response, '500', 'There was an error with your request');
            } else {
		object_json = JSON.parse(object_string);
		request_json = request.body;
		console.log(request.body);
		object_json[property] = request_json;

		object_info = JSON.stringify(object_json);
		redclient.lset(key, id, object_info, function(err, reply){
		    console.log(reply);
		    send_message(response, '200', 'Success', reply);
		});
	   }
	});
    });
   } catch (err){
      send_message(response, '500', 'Error', err);
  }
}


var update_property = function(id, entity, property, request, response, options) {
    //adds data to redis                                                                                               
   try {
    get_subdomain_id(options, function(subdomain_id){
	var key = subdomain_id +":"+ entity;
	redclient.lindex(key, id, function (err, object_string){
	    if ((err) || (!object_string)){
		send_message(response, '500', 'There was an error with your request');
	    } else {
		object_json = JSON.parse(object_string);
		property_json = object_json[property];
		request_json = request.body;
		if (!property_json){
		    object_json[property] = request_json;
		} else {
		    request_json = request.body;
		    console.log(request.body);
		    for(var i in request_json){
			var cur_key = i;
			var val = request_json[i];
			console.log(val);
			property_json[cur_key] = val;
		    }
		    object_json[property] = property_json;
		}
		
		object_info = JSON.stringify(object_json);
      
		redclient.lset(key, id, object_info, function(err, reply) {
		    console.log(reply);
		    send_message(response, '200', 'Success', reply);
		});
	    }
	});
    });
   } catch (err){
      send_message(response, '500', 'Error');
  }
}


var delete_property = function(id, entity, property, request, response, options) {
    //adds data to redis                                                                                               
   try {
    get_subdomain_id(options, function(subdomain_id){
	var key = subdomain_id +":"+ entity;
	redclient.lindex(key, id, function (err, object_string){
            if ((err) || (!object_string)){
		send_message(response, '500', 'There was an error with your request');
	    } else {
		object_json = JSON.parse(object_string);
		if (object_json[property]) {
		    delete object_json[property];
		}
		object_info = JSON.stringify(object_json);
		redclient.lset(key, id, object_info, function(err, reply){
		    console.log(reply);
		    send_message(response, '200', 'Success', reply);
		});
	    }
	});
    });
   } catch (err){
      send_message(response, '500', 'Error');
  }
}

var send_message = function(response, status, message, json) {
    var send_msg;
    if (!json) {
        json = {"Message" : message };
	json = JSON.stringify(json);
    }
    response.status(status);
    response.setHeader('content-type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
  
    response.send(beautify(json));
    response.end();
}

module.exports = {
    delete_object: delete_object,
    get_object: get_object,
    create_object: create_object,
    update_object: update_object,
    delete_property: delete_property,
    get_property: get_property,
    create_property: create_property,
    update_property: update_property
}
