var url = require('url');
var _ = require('underscore');
var persist = require('node-persist');
var uuid = require('node-uuid');

var config = require(__dirname + '/../../../config.js');
var help = require(__dirname + '/../help');

function mustAuthenticate(path) {
    path = url.parse(path, true);
    // all /api requests must be authenticated
    if (path.pathname.indexOf('api') > -1) return true;
    else return false;
}

// This attaches middleware to the passed in app instance
module.exports = function (router) {
    persist.initSync();
    if(!persist.getItem('token')){
        persist.setItemSync('token',[]);
    }

    var tokenRoute = '/token';

    // Authorize
    router.use(function (req, res, next) {

        // Let requests for tokens through, along with endpoints configured to not use authentication
        if (req.url === tokenRoute || !mustAuthenticate(req.url)) return next();

        // require an authorization header for every request
        if (!(req.headers && req.headers.authorization)) 
            return help.displayUnauthorizationError(res, 'There isn\'t authorization header');

        // Strip token value out of request headers
        var parts = req.headers.authorization.split(' ');
        var token;

        // Headers should be `Authorization: Bearer <%=tokenvalue%>`
        if (parts.length == 2 && /^Bearer$/i.test(parts[0])) {
            token = parts[1];
        }

        if (!token) return fail();
        var token_list = persist.getItem('token');
        if(token_list.length > 0) {
            var existToken = 0;
            for(var i = 0; i < token_list.length; i++) {
                var local_token_item = token_list[i];
                if(token == local_token_item.token && parseInt(local_token_item.tokenExpire) >= Date.now()) {
                    existToken++;
                } 
            }
            if(existToken > 0) {
                return next();
            } else {
                help.displayUnauthorizationError(res, 'Invalid token');
            }
        } else {
            help.displayUnauthorizationError(res, 'Token doesn\'t exist');
        }
    });

    // Setup token service
    router.use(tokenRoute, function (req, res, next) {
        var method = req.method && req.method.toLowerCase();
        if (method === 'post') {
            var clientId = req.body.clientId;
            var secret = req.body.secret;
            if(clientId == config.get('auth.clientId') && secret == config.get('auth.secret')) {
                var token = uuid.v4();
                var token_list = persist.getItem('token');
                token_list.push({token: token, tokenExpire: Date.now() + (config.get('auth.tokenTtl') * 1000)});
                persist.setItemSync('token', token_list);

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store');
                res.setHeader('Pragma', 'no-cache');
                res.end(JSON.stringify({
                    accessToken: token,
                    tokenType: "Bearer",
                    expiresIn: config.get('auth.tokenTtl')
                }));
            } else {
                help.displayUnauthorizationError(res);
            }
        }
        next();
    });
};
