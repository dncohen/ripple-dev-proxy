var authinfo_url = 'https://id.ripple.com';

var request = require('request');

var id_cache = {
  //"rrrrrrrrrrrrrrrrrrrrBZbvji": "ONE",
};

exports.lookup = function(acct) {
  if (id_cache.hasOwnProperty(acct)) {
    // This acct is cached or pending lookup.  Nothing to do.
    return;
  }
  
  id_cache[acct] = -1;  // pending
  
  request(authinfo_url + '/v1/user/' + acct, function (error, response, body) {

    if (!error && response.statusCode == 200) {
      //console.log(body);
      var json = JSON.parse(body);
      //console.log(json);
      //console.log("adding " + acct + " = " + json.username + " to cache.");
      id_cache[acct] = json.username;
    }
  });
};

exports.getCache = function(acct, wait) {
  wait = typeof wait !== 'undefined' ? wait : 1000; // default wait time
  
  if (id_cache.hasOwnProperty(acct)) {
    if (id_cache[acct] === -1 && wait) {
      // lookup is pending.  Wait?
    }
    else {
      return id_cache[acct];
    }
  }
  return false;
};
