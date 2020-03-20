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
		super({ allowHalfOpen: true });

		this.setEncoding('utf8');
		this.setNoDelay(true);

		this.ipcPath = null;
		this.connected = false;

		this.on('connect', () =>
		{
			this.connected = true;
			debug('Socket connected');
		});

		this.on('close', (hadError) =>
		{
			this.connected = false;

			/* Errors are handled on "error" listener */
			if(hadError) return;

			debug('Socket disconnected');
		});

		this.on('error', this._onUnixError);
	}

	connectSocket(opts, cb)
	{
		cb = cb || noop;

		debug(`Connecting ${this._connectType}...`);

		switch(this._connectType)
		{
			case 'socket':
				this.ipcPath = opts.ipcPath;
				this._connectUnix(cb);
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
				this._disconnectUnix(cb);
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

	_connectUnix(cb)
	{
		if(this.connected) return cb(null);

		debug('Connecting to UNIX socket...');

		if(!fs.existsSync(this.ipcPath))
		{
			fs.writeFileSync(this.ipcPath);
			debug(`Created new socket file: ${this.ipcPath}`);
		}

		var accessDone = false;

		var watcher = fs.watch(this.ipcPath, (eventType) =>
		{
			debug('Player accessed socket event: ' + eventType);

			if(eventType === 'change')
				return;
			else if(!accessDone)
				return accessDone = true;

			watcher.close();
			debug('File watcher closed');

			if(timeout)
			{
				clearTimeout(timeout);
				timeout = null;
			}

			this.connect(this.ipcPath);

			cb(null);
		});

		timeout = setTimeout(() =>
		{
			timeout = null;
			watcher.close();

			var errMsg = 'Socket connect timeout';
			debug(errMsg);

			cb(new Error(errMsg));
		}, 10000);
	}

	_disconnectUnix(cb)
	{
		if(timeout)
		{
			clearTimeout(timeout);
			timeout = null;
		}

		if(!this.destroyed)
		{
			this.destroy();
			debug('Socket destroyed');
		}

		fs.access(this.ipcPath, fs.constants.F_OK, (err) =>
		{
			if(err)
			{
				debug('No access to socket file');
				debug(err);

				return cb(err);
			}

			fs.unlink(this.ipcPath, (err) =>
			{
				if(err)
					debug('Could not remove socket file');
				else
					debug('Socket file removed');

				cb(err);
			});
		});
	}

	_onUnixError(err)
	{
		if(!this.connecting)
			this.connect(this.ipcPath);
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
