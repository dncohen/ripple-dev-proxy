var config = {};

config.rest = {
  port: 5050,
  url: "https://api.ripple.com"
};

config.rpc = {
  port: 5005,
  url: "http://s1.ripple.com:51234"
}

// Use a local rippled with something like:
//config.rpc.url = "http://va:5005"; // Dave's local.

module.exports = config;
