const fs = require('fs');
const { spawn } = require('child_process');
const noop = () => {};
const playersArray = fs.readdirSync(__dirname + '/players');

const defaults = {
	media: null,
	player: 'mpv',
	playerArgs: [''],
	ipcPath: '/tmp/media-ctl-socket'
};

var players = importPlayers();

module.exports = class PlayerController
{
	constructor(options)
	{
		if(!(options instanceof Object)) options = {};
		this.opts = { ...defaults, ...options };

		this.process = null;
		this.player = players[this.opts.player] || players[defaults.player];

		this.launch = (cb) =>
		{
			cb = cb || noop;
			var called = false;

			if(typeof this.opts.ipcPath !== 'string' && !this.opts.ipcPath.length)
				return cb(new Error('No IPC socket path provided!'));

			if(typeof this.opts.media !== 'string' && !this.opts.media.length)
				return cb(new Error('No media source provided!'));

			this.player.init(this.opts, (err) =>
			{
				/*
				Callback on error and success
				Success only occurs after non-error process spawn
				*/
				if(!called)
				{
					called = true;
					return cb(err);
				}
			});

			const spawnOpts = { stdio: ['ignore', 'pipe', 'ignore'], detached: true };
			const spawnArgs = this.player.getSpawnArgs(this.opts);

			try { this.process = spawn(this.opts.player, spawnArgs, spawnOpts); }
			catch(err)
			{
				/* Callback only on error */
				if(!called)
				{
					called = true;
					return cb(err);
				}
			}

			this.process.once('exit', () =>
			{
				this.process = null;
				this.player.destroy(this.opts);
			});
		}

		this.quit = (cb) =>
		{
			cb = cb || noop;

			if(this.process)
			{
				this.player.stop(err =>
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

		const shutdown = (err) =>
		{
			if(err) console.error(err);

			this.quit(() => process.exit());
		}

		/* Close spawn process on app exit */
		process.on('SIGINT', () => shutdown());
		process.on('SIGTERM', () => shutdown());
		process.on('uncaughtException', shutdown);
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
