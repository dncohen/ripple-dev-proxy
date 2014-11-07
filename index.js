var util = require('util');
var http = require('http');
var httpProxy = require('http-proxy');
var traverse = require('traverse');
var id = require('./id');

var colors = require('colors');
colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

JSON.minify = JSON.minify || require("node-json-minify");

var prettyjson = require('prettyjson');

var cache = {};

//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer({secure: false});


//
// Create your custom server and just call `proxy.web()` to proxy
// a web request to the target passed in the options
// also you can use `proxy.ws()` to proxy a websockets request
//
var server = http.createServer(function(req, res) {
  // You can define here your custom logic to handle the request
  // and then proxy the request.
  
  var _write = res.write;
  res.rippleBuffer = '';
  
  res.write = function (data) {
    //_write.call(res, data.toString().replace("Ruby", "nodejitsu"));
    console.log(data);
    res.rippleBuffer = res.rippleBuffer + data.toString();
    
    _write.call(res, data);
  };


  proxy.web(req, res, {
    // @todo make configurable
    target: 'https://api.ripple.com'
  });
  

  // not called?
  res.on('write', function(data) {
    debugger;
  });
});


proxy.on('end', function (req, res, proxyRes) {
  //console.log('RAW END Response from the target', JSON.stringify(proxyRes.headers, true, 2));
  if (!res.rippleBuffer) {
    return;
  }
  
  var replace = {};
  var regReplace = {
  };
  
  // Now buffer has entire JSON returned.
  var json = JSON.parse(res.rippleBuffer);
  //console.log(prettyjson.render(json));
  //console.log(util.inspect(json, {depth: null, colors: true}));
  
  traverse(json).forEach(function (item) {
    // console.log(this.key + " : " + item);

    // @todo break this out into another file.
    if (this.key == 'base_fee_xrp') {
      
      regReplace['base_fee_xrp: .*' + item + '.*,'] = '$& // ' + (item * 1000000) + ' drops';
    }
    
    if (this.key == 'Account' || this.key == 'issuer' || this.key == 'Destination') {
      id.lookup(item);

      // Using .* to match color codes.
      regReplace[this.key +": .*'(.*)'.*,?"] = function(match, p1) {
        //debugger;
        var name = id.getCache(p1);
        if (name) {
          return match + (' // ~' + id.getCache(p1)).debug.bold;
        }
        else {
          // We don't have a name (might be waiting for reply)
          return match;
        }
      };
    }

    if (this.key == 'Balance' && this.isLeaf && item > 0) {
      // Convert drops to XRP
      regReplace["Balance: .*" + item + "[^,]*,?"] = "$& " + ("// " + item / 1000000 + " XRP").verbose;      
    }
    
    if (this.key == 'Flags' && item > 0) {
      // Should be a generic regexp to match all Flags lines, but color codes makes it trickier.
      regReplace["Flags: .*" + item + "[^,]*,?"] = "$& " + ("// " + item.toString(2)).verbose;
    }

    if (this.key == 'date' && item > 0) {
      // Should be a generic regexp to match all dates, but color codes makes it trickier.
      regReplace["date: .*" + item + "[^,]*,?"] = '$& ' + ("// " + Date(item + 946684800)).verbose;
    }
  });
  
  // @todo find a way to wait here for name lookups, etc.
  // If call setTimeout now, _write.call will come too late.

  setTimeout(function() {

    traverse(json).forEach(function (item) {
      if (typeof(item) == 'object' && typeof(item.currency) != 'undefined') {
        //debugger;
        var name = id.getCache(this.node.issuer);
        if (name) {
          // TODO round to shorter number
          this.node['__description__'] = this.node.value + ' ' + this.node.currency + ' @ ' + name;
        }
        else {
          this.node['__description__'] = this.node.value + ' ' + this.node.currency;
        }
      }

      // if (this.isLeaf && this.key == 'Account') {
      //   var name = id.getCache(item);
      //   if (name) {
      //     this.parent.node['_accountName'] = name;
      //   }
      // }
    });

    var output = util.inspect(json, {depth: null, colors: true});
    
    // Simple string replacements
    traverse(replace).forEach(function (item) {
      debugger; // deprecated
      if (this.isLeaf) {
        if (typeof item == 'string') {
          output = output.replace(this.key, this.key + ' ' + item);
        }
        else {
          output = output.replace(this.key, item);
        }
      }
    });
    
    // Regular expression replacements.
    traverse(regReplace).forEach(function (item) {
      if (this.isLeaf) {
        var re = new RegExp(this.key, 'g');
        output = output.replace(re, item);
      }
    });
    
    console.log(); // TODO date and request.
    console.log(output);
    console.log();
    
  }, 1000);
  
});


// To modify the proxy connection before data is sent, you can listen
// for the 'proxyReq' event. When the event is fired, you will receive
// the following arguments:
// (http.ClientRequest proxyReq, http.IncomingMessage req,
//  http.ServerResponse res, Object options). This mechanism is useful when
// you need to modify the proxy request before the proxy connection
// is made to the target.
//
proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('X-Special-Proxy-Header', 'foobar');
});

//
// Listen for the `error` event on `proxy`.
proxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });

  res.end('Something went wrong. And we are reporting a custom error message.');
});

//
// Listen for the `proxyRes` event on `proxy`.
//
proxy.on('proxyRes', function (proxyRes, req, res) {
  console.log('RAW Response from the target', JSON.stringify(proxyRes.headers, true, 2));
  //res.write('/* on proxyRes */');
});



//
// Listen for the `proxySocket` event on `proxy`.
//
proxy.on('proxySocket', function (proxySocket) {
  // listen for messages coming FROM the target here
  proxySocket.on('data', hybiParseAndLogMessage);
});



console.log("listening on port 5050")
server.listen(5050);