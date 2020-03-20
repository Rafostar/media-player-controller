const fs = require('fs');
const net = require('net');
const debug = require('debug')('mpc:socket');
const helper = require('./helper');
const noop = () => {};

var timeout;

module.exports = class PlayerSocket extends net.Socket
{
	constructor()
	{
		super();

		this.setEncoding('utf8');
		this.setNoDelay(true);
		this.connected = false;
	}

	connectSocket(opts, cb)
	{
		cb = cb || noop;

		debug(`Connecting ${this._connectType}...`);

		switch(this._connectType)
		{
			case 'socket':
				this._connectUnix(opts.ipcPath, cb);
				break;
			case 'web':
				this._connectWeb(opts.httpPort, cb);
				break;
			default:
				cb(new Error(`Unsupported connection: ${this._connectType}`));
				break;
		}
	}

	disconnectSocket(opts, cb)
	{
		cb = cb || noop;

		debug(`Disconnecting ${this._connectType}...`);

		switch(this._connectType)
		{
			case 'socket':
				this._disconnectUnix(opts.ipcPath, cb);
				break;
			case 'web':
				this._disconnectWeb();
				this.connected = false;
				cb(null);
				break;
			default:
				cb(new Error(`Unsupported disconnection: ${this._connectType}`));
				break;
		}
	}

	_connectUnix(ipcPath, cb)
	{
		debug('Connecting to UNIX socket...');

		if(!fs.existsSync(ipcPath))
		{
			fs.writeFileSync(ipcPath);
			debug(`Created new socket file: ${ipcPath}`);
		}

		this.connected = false;

		timeout = setTimeout(() =>
		{
			timeout = null;
			this.removeListener('connect', onConnect);
			debug('Removed "connect" event listener');

			this.removeListener('error', onError);
			debug('Removed "error" event listener');

			var errMsg = 'Socket connect timeout';
			debug(errMsg);

			cb(new Error(errMsg));
		}, 10000);

		const onConnect = function()
		{
			/* Listener is "once", so auto removed on event */
			debug('Removed "connect" event listener');

			if(!timeout) return;

			clearTimeout(timeout);
			timeout = null;

			this.connected = true;
			this.once('close', onDisconnect);
			debug('Added "close" event listener');

			debug('Socket connected');
			cb(null);
		}

		const onDisconnect = function()
		{
			/* Listener is "once", so auto removed on event */
			debug('Removed "close" event listener');

			this.connected = false;
			this.removeListener('error', onError);
			debug('Removed "error" event listener');
		}

		const onError = function(err)
		{
			debug(err);

			if(!this.connecting)
				this.connect(ipcPath);
		}

		this.once('connect', onConnect);
		debug('Added "connect" event listener');

		this.on('error', onError);
		debug('Added "error" event listener');

		var accessDone = false;

		var watcher = fs.watch(ipcPath, (eventType) =>
		{
			debug('Player accessed socket event: ' + eventType);

			if(eventType === 'change')
				return;
			else if(!accessDone)
				return accessDone = true;

			watcher.close();
			this.connect(ipcPath);

			debug('File watcher closed');
		});
	}

	_disconnectUnix(ipcPath, cb)
	{
		if(timeout)
		{
			clearTimeout(timeout);
			timeout = null;
		}

		if(!this.destroyed)
		{
			this.destroy();
			this.connected = false;

			debug('Socket destroyed');
		}

		fs.access(ipcPath, fs.constants.F_OK, (err) =>
		{
			if(err)
			{
				debug('No access to socket file');
				debug(err);

				return cb(err);
			}

			fs.unlink(ipcPath, (err) =>
			{
				if(err)
					debug('Could not remove socket file');
				else
					debug('Socket disconnected');

				cb(err);
			});
		});
	}

	_connectWeb(httpPort, cb)
	{
		timeout = setTimeout(() => timeout = null, 10000);
		this._waitWebServer(httpPort, cb);
	}

	_waitWebServer(httpPort, cb)
	{
		helper.httpRequest({ nodebug: true, port: httpPort }, err =>
		{
			if(err && timeout)
				return setTimeout(() => this._waitWebServer(httpPort, cb), 500);
			else if(err)
				return cb(new Error('Web server connect timeout'));

			/* When retry is true timeout is not finished */
			if(timeout)
			{
				clearTimeout(timeout);
				timeout = null;
			}

			this.connected = true;
			debug('Web server connected');

			cb(null);
		});
	}

	_disconnectWeb()
	{
		debug('Web server disconnected');

		if(!timeout) return;

		clearTimeout(timeout);
		timeout = null;
	}
}
