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

			if(typeof this.opts.ipcPath !== 'string' && !this.opts.ipcPath.length)
				return cb(new Error('No IPC socket path provided!'));

			if(typeof this.opts.media !== 'string' && !this.opts.media.length)
				return cb(new Error('No media source provided!'));

			const spawnOpts = { stdio: ['ignore', 'pipe', 'ignore'], detached: true };
			const spawnArgs = this.player.getSpawnArgs(this.opts);

			try { this.process = spawn(this.opts.player, spawnArgs, spawnOpts); }
			catch(err) { return cb(err); }

			this.process.once('close', () => this.process = null);
			this.process.stdout.once('data', () => this.player.init(this.opts));

			return cb(null);
		}

		this.quit = (cb) =>
		{
			cb = cb || noop;

			if(this.process)
			{
				this.player.stop((err) =>
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
