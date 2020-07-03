# media-player-controller
[![License](https://img.shields.io/github/license/Rafostar/media-player-controller.svg)](https://github.com/Rafostar/media-player-controller/blob/master/LICENSE)
[![npm](https://img.shields.io/npm/v/media-player-controller.svg)](https://www.npmjs.com/package/media-player-controller)
[![Downloads](https://img.shields.io/npm/dt/media-player-controller.svg)](https://www.npmjs.com/package/media-player-controller)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TFVDFD88KQ322)
[![Donate](https://img.shields.io/badge/Donate-PayPal.Me-lightgrey.svg)](https://www.paypal.me/Rafostar)

Spawn media player app and control playback. Also allows reading player state through socket or web connection.

## Supported Media Players

|   Player   | Linux |  Win  | MacOS |
| :--------: | :---: | :---: | :---: |
|  **mpv**   |  yes  |  no   |   ?   |
|  **vlc**   |  yes  |  yes  |   ?   |

  ? - untested (feedback is welcome)

### Player config
```javascript
var player = new PlayerController({
  app: 'mpv',                         // Media player name to use (mpv/vlc)
  args: [],                           // Player command line args (array of strings)
  cwd: null,                          // Current working dir for media player spawn
  media: '/path/to/video.mp4',        // Media to load on player launch (required)
  ipcPath: '/tmp/media-ctl-socket',   // Path to socket connection file (mpv only)
  httpPort: 9280,                     // HTTP port for local communication (vlc only)
  httpPass: null,                     // HTTP login password (vlc only, defaults to player name)
  detached: false                     // Spawn player as detached process
});
```

### Player functions
Each playback controlling function have an optional callback with eventual `error`.<br>
They are executed asynchronously by default and can be used after `playback-started` event.

```javascript
.launch()                    // Launch media player
.quit()                      // Stop media player process

.play()                      // Resume playback
.pause()                     // Pause playback
.cyclePause()                // Cycle play/pause
.load(mediaPath)             // Load new media file (without closing player)
.seek(position)              // Seek to position (value in seconds)
.setVolume(value)            // Adjust player volume (value 0-1)
.setSpeed(value)             // Adjust playback speed (normal: 1.0)
.setRepeat(isEnabled)        // Repeat playback (true or false)
.cycleVideo()                // Switch active video track
.cycleAudio()                // Switch active audio track
.cycleSubs()                 // Switch active subtitle track
.addSubs(subsPath)           // Add subtitles to currently playing video
.setFullscreen(isEnabled)    // Enable or disable fullscreen (true or false)
.cycleFullscreen()           // Toggle fullscreen on/off
.keepOpen(isEnabled)         // Keep player open after playback (true or false)

.command([args])             // Custom command for IPC/HTTP (array of args)
```

Please note that some commands are not yet implemented for every player (most of them are).
If a command is not available for currently used player, callback will return error with a message saying so.

### Available events
```javascript
.on('app-launch')            // Emited on media player app launch
.on('playback-started')      // Playback started and player can now be controlled
.on('playback', data)        // Data object with current playback event
.on('app-exit', code)        // Exit code emited on media player app close
```

## Usage Example
```javascript
const PlayerController = require('media-player-controller');

var player = new PlayerController({
  app: 'mpv',
  args: ['--fullscreen'],
  media: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
});

player.on('playback', console.log);

player.on('playback-started', () => {
  console.log('Playback started. Player can now be controlled');
});

player.on('app-exit', (code) => {
  console.log(`Media player closed. Exit code: ${code}`);
});

player.launch(err => {
  if(err) return console.error(err.message);
  console.log('Media player launched');
});
```

## Donation
If you like my work please support it by buying me a cup of coffee :-)

[![PayPal](https://github.com/Rafostar/gnome-shell-extension-cast-to-tv/wiki/images/paypal.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TFVDFD88KQ322)
