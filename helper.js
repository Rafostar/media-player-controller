const isWin = process.platform === 'win32';

module.exports =
{
	getConnectMethod: function(opts)
	{
		if(!isWin || opts.ipcPath.includes('\\.\\pipe\\'))
			return 'unix';
		else
			return 'web';
	}
}
