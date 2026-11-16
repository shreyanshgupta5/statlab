import { Config } from "@remotion/cli/config";
// Use the Chromium that is already installed on this machine instead of downloading one.
// On your own computer you can delete this line: Remotion downloads its own browser.
Config.setBrowserExecutable("/opt/pw-browsers/chromium-1243/chrome-linux64/chrome");
Config.setVideoImageFormat("jpeg");
// 3D (three.js) needs WebGL; this machine has no GPU, so use the software renderer
Config.setChromiumOpenGlRenderer("swangle");
