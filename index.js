const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const debug = require('debug')('mpc');
const socket = require('./socket');

const noop = () => {};
const playersArray = fs.readdirSync(__dirname + '/players');

const defaults = {
	app: 'mpv',
	args: [],
	media: null,
	ipcPath: '/tmp/media-ctl-socket',
	httpPort: 9280,
	httpPass: null,
	detached: false
};

var players = importPlayers();

module.exports = class PlayerController extends net.Socket
{
	constructor(options)
	{
		super();

		if(!(options instanceof Object)) options = {};
		this.connected = false;
		this.destroyed = false;
		this.opts = { ...defaults, ...options };
		this.process = null;

		if(debug.enabled) this.on('playback', debug);
	}

	launch(cb)
	{
		cb = cb || noop;

		/*
		  Allows controller opts to be edited later on
		  without affecting current spawn
		*/
		var launchOpts = Object.assign(defaults, this.opts);
		var player = players[launchOpts.app];

		if(!player)
			return cb(new Error(`Unsupported player: ${launchOpts.app}`));

		Object.keys(player).forEach(key =>
		{
			this[key] = player[key];
		});

		/* Replace optional values */
		this._app = player._app || launchOpts.app;
		this._forceEnglish = player._forceEnglish || false;

		debug(`Launching ${this._app}...`);

		var called = false;

		if(typeof launchOpts.ipcPath !== 'string' || !launchOpts.ipcPath.length)
			return cb(new Error('No IPC socket path provided!'));

		if(this._connectType === 'socket')
			debug('Player IPC:', launchOpts.ipcPath);

		if(typeof launchOpts.media !== 'string' || !launchOpts.media.length)
			return cb(new Error('No media source provided!'));

		debug('Player media source:', launchOpts.media);

		socket.connect(this, launchOpts, (err) =>
		{
			/*
			  Callback on error and success
			  Success only occurs after non-error process spawn
			*/
			if(called) return;

			called = true;

			if(err) return this._killPlayer(() => cb(err));

			if(
				this.init
				&& typeof this.init === 'function'
			)
				this.init();

			if(
				this._parseSocketData
				&& typeof this._parseSocketData === 'function'
			)
				this.on('data', this._parseSocketData);

			debug('Player launched successfully');
			this.emit('app-launch');

			return cb(null);
		});

		var spawnOpts = {
			stdio: ['ignore', 'pipe', 'ignore'],
			detached: launchOpts.detached
		};

		debug('Player detached:', spawnOpts.detached);

		if(this._forceEnglish)
		{
			debug('Forcing player english language');
			spawnOpts.env = { ...process.env, LANG: 'C' };
		}

		if(!Array.isArray(launchOpts.args))
		{
			debug('No additional launch args specified');
			launchOpts.args = [];
		}

		const spawnArgs = this._getSpawnArgs(launchOpts);

		try {
			this.process = spawn(this._app, spawnArgs, spawnOpts);
		}
		catch(err) {
			debug(err);

			if(called) return;

			called = true;
			return cb(err);
		}

		debug('Spawned new player process');

		this.process.stdout.setEncoding('utf8');
		this.process.stdout.setNoDelay(true);

		const stdoutDebug = function(stdoutData)
		{
			if(debug.enabled)
				debug(stdoutData);
		}

		this.process.stdout.on('data', stdoutDebug);

		this.process.once('exit', (code) =>
		{
			if(this.process.stdout)
				this.process.stdout.removeListener('data', stdoutDebug);

			this.process = null;
			debug('Media player process exit');

			if(code && !called)
			{
				called = true;
				return cb(new Error(
					`Media player exited with error code: ${code}`)
				);
			}

			if(
				this._parseSocketData
				&& typeof this._parseSocketData === 'function'
			)
				this.removeListener('data', this._parseSocketData);

			if(this.cleanup && typeof this.cleanup === 'function')
				this.cleanup();

			socket.disconnect(this, launchOpts, (err) =>
			{
				if(err) this.emit('app-error', err);

				this.emit('app-exit', code);
			});
		});
	}

	load(media, cb)
	{
		if(!media || typeof media === 'function')
		{
			cb = media;
			media = this.opts.media;
		}

		cb = cb || noop;
		this._load(media, cb);
	}

	quit(cb)
	{
		cb = cb || noop;

		if(this.process)
		{
			this._playerQuit(err =>
			{
				if(!err)
				{
					debug('Stopped media player process');
					return cb(null);
				}

				debug('Killing media player process...');
				this._killPlayer(cb);
			});
		}
		else
			return cb(new Error('No open player process found!'));
	}

	_getSupportedPlayers()
	{
		return Object.keys(players);
	}

	_killPlayer(cb)
	{
		cb = cb || noop;

		if(this.process)
		{
			try { this.process.kill('SIGINT'); }
			catch(err) { return cb(err); }

			debug('Killed media player process');
		}

		cb(null);
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
