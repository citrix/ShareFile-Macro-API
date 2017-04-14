var http = require("request");
var url = require("url");
var fs = require('fs');

var e_port;
var e_host;
var e_index;

var env_dir = '/home/azureuser/citrix/ShareFile-env/'
var elastic_path = env_dir + 'elastic-settings.js';
var elastic;
if (fs.existsSync(elastic_path)) {
    var elastic_info = require(elastic_path);
    elastic = elastic_info.settings;
    e_port = elastic.port;
    e_host = elastic.hostname;
    e_index = elastic.index;

    console.log("Elastic Server Host: " + e_host + ":" + e_port);
}
else {
    console.log("Missing elastic-settings.js file. Exiting");
    process.exit(-1);
}

var WriteLog = function (type,direction,reqdata,msg)
{
    //Get method and status from request and response itself.
    var index = e_index;
    var data;

    if(direction == "C>")
    {
        index = index + "c_out";
        data = {
            "type": type,
            "direction": direction,
            "timestamp": new Date().toJSON(),
            "request": reqdata.path,
            "host": reqdata.hostname,
            "method": reqdata.method,
            "msg": msg,
            "query": reqdata.query
        };
    }

    if(direction == "C<")
    {
        index = index + "c_in";
        data = {
            "type": type,
            "direction": direction,
            "timestamp": new Date().toJSON(),
            "request": reqdata.path,
            "host": reqdata.connection.servername,
            "method": reqdata.method,
            "msg": msg,
            "query": reqdata.query,
            "status": reqdata.statusCode
        };
    }

    if(direction == "B<")
    {
        index = index + "b_in";
        data = {
            "type": type,
            "direction": direction,
            "timestamp": new Date().toJSON(),
            "request": reqdata.path,
            "host": reqdata.hostname,
            "method": reqdata.method,
            "msg": msg,
            "query": reqdata.query,
            "status": reqdata.statusCode
        };
    }

    if(direction == "B>")
    {
        index = index + "b_out";
        data = {
            "type": type,
            "direction": direction,
            "timestamp": new Date().toJSON(),
            "request": reqdata.path,
            "host": reqdata.hostname,
            "method": reqdata.method,
            "msg": msg,
            "query": reqdata.query,
            "status": reqdata.statusCode

        };
    }

    if(direction == "S>")
    {
        index = index + "s_out";
        data = {
            "type": type,
            "direction": direction,
            "timestamp": new Date().toJSON(),
            "request": "Authentication",
            "msg": msg,
            "data": reqdata
        };
    }

    if(direction == "S<")
    {
        index = index + "s_in";
        data = {
            "type": type,
            "direction": direction,
            "timestamp": new Date().toJSON(),
            "request": "Authentication",
            "msg": msg,
            "data": reqdata
        };
    }

    http.post(
        'http://'+e_host+':'+e_port+'/'+index+'/post/',
        { json: data },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
                console.log(response);
            }
        }
    );
}

module.exports = {
    WriteLog: WriteLog
}