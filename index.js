const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const debug = require('debug')('mpc');
const PlayerSocket = require('./socket');

const noop = () => {};
const playersArray = fs.readdirSync(
	path.join(__dirname, 'players')
);

const defaults = {
	app: 'mpv',
	args: [],
	cwd: null,
	media: null,
	ipcPath: '/tmp/media-ctl-socket',
	httpPort: 9280,
	httpPass: null,
	detached: false
};

var players = importPlayers();

module.exports = class PlayerController extends PlayerSocket
{
	constructor(options)
	{
		super();

		if(!(options instanceof Object)) options = {};
		this.opts = { ...defaults, ...options };
		this.process = null;
		this.prevProbeAt = null;
		this.probeTime = 950;

		if(debug.enabled)
			this.on('playback', debug);
	}

	launch(cb)
	{
		cb = cb || noop;

		/* Recalculate probe time from start */
		this.prevProbeAt = null;
		this.probeTime = 950;

		/* Reemit "playback-started" event */
		this.removeListener('playback', this._checkPlaybackStarted);

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

		this.connectSocket(launchOpts, (err) =>
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
			this.on('playback', this._checkPlaybackStarted);

			return cb(null);
		});

		var spawnOpts = {
			stdio: ['ignore', 'pipe', 'ignore'],
			detached: launchOpts.detached,
			cwd: launchOpts.cwd
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

		const onSpawnError = (err) =>
		{
			if(!this.process.pid)
				this.process = null;

			debug(err);

			if(called) return;

			called = true;
			cb(err);
		}

		try {
			this.process = spawn(this._app, spawnArgs, spawnOpts);
		}
		catch(err) {
			onSpawnError(err);
		}

		this.process.once('error', onSpawnError);
		this.process.stdout.setEncoding('utf8');
		this.process.stdout.setNoDelay(true);

		if(debug.enabled)
		{
			this.process.stdout.on('data', debug);
			debug('Spawned new player process');
		}

		this.process.once('exit', (code) =>
		{
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

			this.disconnectSocket(launchOpts, (err) =>
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

		this.removeListener('playback', this._checkPlaybackStarted);
		this._load(media, (err) =>
		{
			if(!err) this.on('playback', this._checkPlaybackStarted);

			return cb(err);
		});
	}

	quit(cb)
	{
		cb = cb || noop;

		if(this.process)
		{
			if(debug.enabled && this.process.stdout)
				this.process.stdout.removeListener('data', debug);

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

	_getProbeTime(isPlaying, currTime)
	{
		if(!isPlaying || !currTime)
			return 1000;

		if(currTime <= 0)
			return 200;

		if(this.prevProbeAt == currTime)
		{
			if(this.probeTime < 1100)
				this.probeTime += 10;

			return 50;
		}
		else
			this.probeTime -= 10;

		debug(`Next probe in: ${this.probeTime}ms`);
		this.prevProbeAt = currTime;

		return this.probeTime;
	}

	_getSupportedPlayers()
	{
		return Object.keys(players);
	}

	_checkPlaybackStarted(event)
	{
		if(
			event.name !== 'time-pos'
			|| event.value < 1
		)
			return;

		this.removeListener('playback', this._checkPlaybackStarted);
		this.emit('playback-started', true);

		debug('Emited "playback-started" event');
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
