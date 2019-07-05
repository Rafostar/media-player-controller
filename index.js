const fs = require('fs');
const { spawn } = require('child_process');
const noop = () => {};
const playersArray = fs.readdirSync(__dirname + '/players');

const defaults = {
	media: null,
	websocket: null,
	player: 'mpv',
	ipcPath: '/tmp/cast-socket'
};

var players = importPlayers();

module.exports = class PlayerController
{
	constructor(options)
	{
		if(!(options instanceof Object)) options = {};
		const opts = { ...defaults, ...options };

		if(typeof opts.media !== 'string')
			return console.error('No media source provided!');

		if(typeof opts.websocket !== 'string')
			return console.error('No websocket path provided!');

		this.process = null;
		this.player = players[opts.player] || players[defaults.player];

		this.launch = (cb) =>
		{
			cb = cb || noop;

			const spawnOpts = { stdio: ['ignore', 'pipe', 'ignore'], detached: true };
			const spawnArgs = this.player.getSpawnArgs(opts);

			try { this.process = spawn(opts.player, spawnArgs, spawnOpts); }
			catch(err) { return cb(err); }

			this.process.once('close', () => this.process = null);
			this.process.stdout.once('data', () => this.player.init(opts));

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
