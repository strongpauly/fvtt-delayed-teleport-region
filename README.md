<h1 align="center">Delayed Teleport Region</h1>

<p align="center">
    <a href="https://github.com/strongpauly/fvtt-delayed-teleport-region/pulse"><img src="https://img.shields.io/github/last-commit/strongpauly/fvtt-delayed-teleport-region?style=for-the-badge&logo=github&color=7dc4e4&logoColor=D9E0EE&labelColor=302D41"/></a>
    <a href="https://github.com/strongpauly/fvtt-delayed-teleport-region/releases/latest"><img src="https://img.shields.io/github/v/release/strongpauly/fvtt-delayed-teleport-region?style=for-the-badge&logo=gitbook&color=8bd5ca&logoColor=D9E0EE&labelColor=302D41"/></a>
    <a href="https://github.com/strongpauly/fvtt-delayed-teleport-region/stargazers"><img src="https://img.shields.io/github/stars/strongpauly/fvtt-delayed-teleport-region?style=for-the-badge&logo=apachespark&color=eed49f&logoColor=D9E0EE&labelColor=302D41"/></a>
    <br/>
    <br/>
    <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fgithub.com%2Fstrongpauly%2Ffvtt-delayed-teleport-region%2Freleases%2Flatest%2Fdownload%2Fmodule.json&query=%24.compatibility.verified&style=for-the-badge&logo=foundryvirtualtabletop&label=Foundry%20Version&color=%23fe6a1f"/>
    <br/>
    <br/>
</p>

A module for Foundry Virtual Table top that adds a Region Behaviour that teleports a token to another Region after a configured delay.

### Features

- Delay is configurable in seconds.
- Will display scrolling text counting down until the teleport triggers. Can be disabled.
- Count down will only decrement when game is not paused.
- Count down is cancelled if the token leaves the region or is deleted.
- Count down state is stored on the token, so it survives a page refresh or scene change.

### Local Development

1. Copy `foundryconfig.example.json` to `foundryconfig.json` and fill in the paths for your local Foundry VTT installation and data folder.

2. Install dependencies:
   ```sh
   npm install
   ```

3. Link the module into your Foundry VTT data folder:
   ```sh
   npm run link
   ```

4. Build and watch for changes:
   ```sh
   npm run watch
   ```

5. Start Foundry VTT (either manually or via `npm run foundry`) and enable the module in your world.
