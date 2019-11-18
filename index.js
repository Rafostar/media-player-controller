const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const socket = require('./socket');

const noop = () => {};
const playersArray = fs.readdirSync(__dirname + '/players');

const defaults = {
	app: 'mpv',
	args: [''],
	media: null,
	ipcPath: '/tmp/media-ctl-socket',
	detached: false
};

var players = importPlayers();

module.exports = class PlayerController extends net.Socket
{
	constructor(options)
	{
		super();

		if(!(options instanceof Object)) options = {};
		this.opts = { ...defaults, ...options };
		this.process = null;
	}

	launch(cb)
	{
		cb = cb || noop;

		/*
		Allows controller opts to be edited later on
		without affecting current spawn
		*/
		const launchOpts = Object.assign(defaults, this.opts);

		var player = players[launchOpts.app];

		Object.keys(player).forEach(key =>
		{
			this[key] = player[key];
		});

		var called = false;

		if(typeof launchOpts.ipcPath !== 'string' || !launchOpts.ipcPath.length)
			return cb(new Error('No IPC socket path provided!'));

		if(typeof launchOpts.media !== 'string' || !launchOpts.media.length)
			return cb(new Error('No media source provided!'));

		socket.connect(this, launchOpts, (err) =>
		{
			/*
			Callback on error and success
			Success only occurs after non-error process spawn
			*/
			if(!called)
			{
				called = true;

				if(!err)
				{
					if(
						this.init
						&& typeof this.init === 'function'
					)
						this.init();

					this.emit('app-launch');

					if(
						this._parseSocketData
						&& typeof this._parseSocketData === 'function'
					)
						this.on('data', this._parseSocketData);
				}

				return cb(err);
			}
		});

		const spawnOpts = {
			stdio: ['ignore', 'pipe', 'ignore'],
			env: { ...process.env, LANG: 'C' },
			detached: launchOpts.detached
		};
		const spawnArgs = this.getSpawnArgs(launchOpts);

		try { this.process = spawn(launchOpts.app, spawnArgs, spawnOpts); }
		catch(err)
		{
			/* Callback only on error */
			if(!called)
			{
				called = true;
				return cb(err);
			}
		}

		this.process.once('exit', (code) =>
		{
			if(code && !called)
			{
				called = true;
				return cb(new Error(`Media player exited with error code: ${code}`));
			}

			if(
				this._parseSocketData
				&& typeof this._parseSocketData === 'function'
			)
				this.removeListener('data', this._parseSocketData);

			if(this.cleanup && typeof this.cleanup === 'function')
				this.cleanup();

			socket.disconnect(this, launchOpts, () =>
			{
				this.process = null;
				this.emit('app-exit', code);
			});
		});
	}

	quit(cb)
	{
		cb = cb || noop;

		if(this.process)
		{
			this._playerQuit(err =>
			{
				if(err)
				{
					try { this.process.kill('SIGINT'); }
					catch(err) { return cb(err); }
				}

				return cb(null);
			});
		}
		else
			return cb(new Error('No open player process found!'));
	}

	_getSupportedPlayers()
	{
		return Object.keys(players);
	}
}

function importPlayers()
{
	var playersObject = {};

	playersArray.forEach(player =>
	{
		var playerName = player.split('.')[0];
		playersObject[playerName] = require(`./players/${playerName}`);
	});

	return playersObject;
}
