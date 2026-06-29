![Release](https://img.shields.io/github/v/release/3meraldK/earthmc-dynmap) ![Repo size](https://img.shields.io/github/repo-size/EarthMC-Toolkit/earthmc-dynmap) ![Downloads](https://img.shields.io/github/downloads/3meraldK/earthmc-dynmap/total)

> [!IMPORTANT]
> This fork is based on the original **earthmc-dynmap+** project by **3meraldK**, all credit goes to them!\
> My version add new modes, features, fixes minor bugs and makes QoL changes to the default map behaviours.

# earthmc-dynmap+
A web extension for all browsers. Designed specifically for EarthMC's dynamic map, coming with great multitude of useful and cosmetic features.

## Features
When creating the extension, the main idea was to group countries together into their respective organizations and "meganations". Later on, in the natural course of things, the number of new features began to grow with new releases.
* Many map modes to switch between: alliances, meganations, default
* Archive mode to view old claims and statistics (from the Wayback Machine)
* Locate towns, players and nations quickly
* Notifications about new releases
* Look up a player by clicking their name in town's statistics
* Dark mode
* View chunks and real country borders

**Extra features provided by this fork**:
* Bug fixes & performance improvements.
* UI revamp/design tweaks with dedicated mode selector (Toggle with Shift+M).
* Ability to show server info and list of online players.
* Updated `alliances` mode to work again with the new API.
* New modes: `overclaim`, `nationclaims`, `newday` (falling+ruined towns).
* New screenshot button.
* Searching now works in archive mode.
* Changed link button behaviour (updates URL).
* Improved safety by splitting content & page contexts, which communicate via events.
* Restructured backend for clarity & maintainability (including build system).

## Installation (2 methods)
> [!TIP]
> Extension works for desktop and mobile! For the best experience, it is also recommended to use ad-blockers.

### 1. Chromium Extension (Recommended)
There are no extension releases on GitHub or the store. Please visit the [Toolkit Discord](https://discord.gg/AVtgkcRgFs) for up to date builds or install the userscript which will update automatically. Alternatively, you can download this repo source code and do the following:

1. Unzip the repo source code.
1. Go to your browser extension settings.
1. Enable developer mode.
1. Click `Load Unpacked` and select the unzipped folder.

### 2. Userscript
1. Install Violentmonkey extension in either the Firefox, Safari or Chrome store (for Chromium based browsers).
1. Install the **EarthMC Dynmap+ (Owen3H Fork)** script by adding the contents of `./dist/emc-dynmapplus.user.js` into a new script, then save and enable it.

Remember to check for updates frequently if Violentmonkey does not do it automatically.

## Maintainability
Neither this extension nor its maintainer are affiliated with **EarthMC**. Please keep in mind, that the extension may temporarily render unusable due to unexpected **EarthMC** updates. If that is the case, the maintainer will address potential problems sooner or later.

You can report any new issues in the [Toolkit Discord](https://discord.gg/AVtgkcRgFs).

## Support and Contribution <a href="https://discord.gg/AVtgkcRgFs"><img src="https://img.shields.io/discord/966271635894190090?logo=discord"></a>
The maintainer actively cooperates with **EMC Toolkit** (developers of "EarthMC Stats" Discord bot and more), which provides the latest alliance data. You can help maintaining the database by registering a new alliance or requesting a change. [Click here to join](https://discord.gg/AVtgkcRgFs).
