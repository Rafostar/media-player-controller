const http = require('http');
const debug = require('debug')('mpc');
const xml2js = require('xml2js').parseString;

module.exports =
{
	httpRequest: function(opts, cb)
	{
		var reqOpts = {
			host: '127.0.0.1',
			port: opts.port || 9280,
			path: opts.path || '/',
			method: opts.type || 'GET',
			timeout: 3000
		};

		var cred = '';

		if(opts.user)
			cred += opts.user;

		if(opts.pass)
			cred += ':' + opts.pass;

		if(cred)
		{
			reqOpts.headers = {
				Authorization: 'Basic ' + new Buffer(cred).toString('base64')
			}
		}

		var respData = '';

		const onResData = function(data)
		{
			respData += data;
		}

		const onResEnd = function()
		{
			if(!opts.xml)
				return cb(null, respData);

			var xmlOpts = {
				async: opts.async || true,
				explicitArray: opts.array || false,
				explicitRoot: opts.root || false
			};

			xml2js(respData, xmlOpts, cb);
		}

		const onReqError = function(err)
		{
			debug(err);
			cb(err);
		}

		var req = http.request(reqOpts, (res) =>
		{
			res.on('data', onResData);
			res.once('end', () =>
			{
				res.removeListener('data', onResData);
				onResEnd();
			});

			debug('Received response');
			req.removeListener('error', onReqError);
		});

		req.on('error', onReqError);
		req.end(opts.data || null);
		debug('Send HTTP request');
	}
}
