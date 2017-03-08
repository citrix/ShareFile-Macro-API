app.all('/signature*', function(request, response){
  rsProxy(request, response);
});

const rsProxy = function(request, response) {
  console.log ("-C-> "+request.method+" "+request.path);
  var new_path = buildNewPath(request.path);
  console.log ("Path in: " + request.path + "  Cleaned path: " + new_path);
  request.path = new_path;
  var file_array = new_path.split("/");
  var entity_name = request.params.entity;
  console.log("Going to Podio");
  podioauth.set_security (request, response, my_options, new_path, function(set_options, cookie) {
  	set_options.method = retrieveMethod(request);
    var body = retrieveBody(request);
    if (body) {
      set_options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    var entity = capitalizeFirstLetter(request.url);
    var url_path = entity;
    console.log(url_path);
    set_options.path = url_path
  	set_options.method = retrieveMethod(request);
    console.log("<-B-: " + JSON.stringify(set_options));
    var api_request = https.request(set_options, function(api_response) {
      var resultString = "";
      console.log(api_response.statusCode);
      api_response.on('data', function (chunk) {
        resultString+=chunk;
      });
      api_response.on('end', function (chunk) {
        console.log("-B->: [" + api_response.statusCode + "] : [" + JSON.stringify(api_response.headers) + "]");
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.status(200);
        response.setHeader('content-type', 'application/json');
        response.send(beautify(resultString));
        response.end();
      });
    });
    
    if (body) {
      api_request.write(body);
    }
    return api_request.end();
  });
}
