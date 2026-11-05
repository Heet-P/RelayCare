import { Composition } from "remotion";
import { LaunchVideo, LAUNCH_DURATION } from "./LaunchVideo";
import "./style.css";

/** 1080p at 30fps. The 4K master renders the same composition with --scale=2. */
export function Root() {
  return <Composition id="LaunchVideo" component={LaunchVideo} durationInFrames={LAUNCH_DURATION} fps={30} width={1920} height={1080} />;
}
