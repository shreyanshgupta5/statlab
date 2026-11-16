import React from "react";
import { Composition } from "remotion";
import { HelloOneF1 } from "./HelloOneF1";
import { WhoWinsVegas } from "./vegas/WhoWinsVegas";
import { VegasLap3D } from "./track3d/VegasLap3D";
import { VIDEO_LEN } from "./track3d/lapData";
// @ts-ignore
import { DURATION } from "./vegas/legacy";

const FPS = 30, VEGAS_FRAMES = Math.round(DURATION * FPS);
// voiceover / music: put the files in public/ and set the names here (or in Studio props), e.g. "who-wins-vo.mp3"
const VEGAS_AUDIO = { voiceover: null, music: null, musicVolume: 0.25 };

// Each <Composition> is one video. Render with: npx remotion render <id> out/<file>.mp4
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HelloOneF1" component={HelloOneF1} durationInFrames={90} fps={30} width={1080} height={1920}
      defaultProps={{ title: "LIGHTS OUT", value: 37 }} />
    <Composition id="WhoWinsVegasVertical" component={WhoWinsVegas} durationInFrames={VEGAS_FRAMES} fps={FPS} width={1080} height={1920}
      defaultProps={{ mode: "port" as const, ...VEGAS_AUDIO }} />
    <Composition id="WhoWinsVegasWide" component={WhoWinsVegas} durationInFrames={VEGAS_FRAMES} fps={FPS} width={1920} height={1080}
      defaultProps={{ mode: "land" as const, ...VEGAS_AUDIO }} />
    <Composition id="VegasLap3D" component={VegasLap3D} durationInFrames={Math.round(VIDEO_LEN * FPS)} fps={FPS} width={1920} height={1080}
      defaultProps={{ voiceover: null, music: null, musicVolume: 0.25 }} />
  </>
);
