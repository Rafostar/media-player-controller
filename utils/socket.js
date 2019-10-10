const fs = require('fs');

module.exports =
{
	connectSocket: function(socket, opts, cb)
	{
		return this._connectUnixSocket(socket, opts.ipcPath, cb);
	},

	_connectUnixSocket: function(socket, ipcPath, cb)
	{
		if(!fs.existsSync(ipcPath))
			fs.writeFileSync(ipcPath);

		socket.setEncoding('utf8');
		socket.setNoDelay(true);

		const onConnect = function()
		{
			clearTimeout(timeout);
			cb(null);
		}

		const onError = function()
		{
			if(!socket.connecting)
				socket.connect(ipcPath);
		}

		socket.once('connect', onConnect);
		socket.on('error', onError);

		var watcher = fs.watch(ipcPath, () =>
		{
			watcher.close();
			socket.connect(ipcPath);
		});

		var timeout = setTimeout(() => cb(new Error('Socket connection timeout')), 10000);
	},

	removeSocket: function(socket, opts)
	{
		return this._removeUnixSocket(socket, opts.ipcPath);
	},

	_removeUnixSocket: function(socket, ipcPath)
	{
		if(socket && !socket.destroyed)
		{
			socket.removeAllListeners('error');
			socket.destroy();
		}

		if(fs.existsSync(ipcPath))
			fs.unlinkSync(ipcPath);
	}
}
