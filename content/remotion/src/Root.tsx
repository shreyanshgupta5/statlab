import React from "react";
import { Composition } from "remotion";
import { HelloOneF1 } from "./HelloOneF1";

// Each <Composition> is one video. Render with: npx remotion render <id> out/<file>.mp4
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HelloOneF1" component={HelloOneF1} durationInFrames={90} fps={30} width={1080} height={1920}
      defaultProps={{ title: "LIGHTS OUT", value: 37 }} />
  </>
);
