# Video and motion skills

Claude Code skills for making @F1STATLAB reels and graphics: editing, captions, motion graphics, 3D, data animation. They live in `.claude/skills/` and load automatically in every Claude Code session on this branch.

**111 skills** from 26 repos.

Each skill keeps its original licence file. Copied as published, with three local changes: two renamed skills (`tiktok-lower-thirds`, `webgl-threejs-animation`, to avoid duplicate names) and ghost-editor without its 16 MB of demo videos (`docs/media`).

## Not stored here (run `bash tools/install_video_tools.sh`)

- **yt-dlp** (`yt-dlp/yt-dlp`) and **Whisper** (`openai/whisper`): Python tools, installed with pip.
- **motion-video-director** (`mattypark/Motion-graphics-skill`) and **generative-illustration** (`iart-ai/generative-illustration-skills`): no open licence, so downloaded per session instead of committed to this public repo.
- **MotionClone** (`LPengYang/MotionClone`, `Bujiazi/MotionClone`): a research video model that needs an NVIDIA GPU; not usable in cloud sessions. No licence.
- **Awesome Claude Video Skills** (`zhuyansen/awesome-claude-video-skills`): a list of links, not a skill. Its iart-ai entries are the packs below.

## Settings

`.claude/settings.json` sets `DO_NOT_TRACK=1` and `HYPERFRAMES_NO_TELEMETRY=1`, which turns off the anonymous usage tracking built into the HyperFrames media-use scripts.

## Skills by source

### [Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics) · MIT · 6

`explainer-default`, `explainer-engaging`, `explainer-high-energy`, `motion-broll`, `object-separation`, `sound-effects`

### [Impertio-Studio/Three.js-Claude-Skill-Package](https://github.com/Impertio-Studio/Three.js-Claude-Skill-Package) · MIT · 24

`threejs-agents-model-optimizer`, `threejs-agents-scene-builder`, `threejs-core-math`, `threejs-core-raycaster`, `threejs-core-renderer`, `threejs-core-scene-graph`, `threejs-errors-performance`, `threejs-errors-rendering`, `threejs-impl-animation`, `threejs-impl-audio`, `threejs-impl-drei`, `threejs-impl-ifc-viewer`, `threejs-impl-lighting`, `threejs-impl-physics`, `threejs-impl-post-processing`, `threejs-impl-react-three-fiber`, `threejs-impl-shadows`, `threejs-impl-webgpu`, `threejs-impl-xr`, `threejs-syntax-controls`, `threejs-syntax-geometries`, `threejs-syntax-loaders`, `threejs-syntax-materials`, `threejs-syntax-shaders`

### [agricidaniel/claude-shorts](https://github.com/agricidaniel/claude-shorts) · MIT · 1

`shorts`

### [cloudai-x/threejs-skills](https://github.com/cloudai-x/threejs-skills) · MIT · 13

`threejs-animation`, `threejs-asset-pipeline`, `threejs-fundamentals`, `threejs-geometry`, `threejs-interaction`, `threejs-lighting`, `threejs-loaders`, `threejs-materials`, `threejs-performance`, `threejs-postprocessing`, `threejs-react-three-fiber`, `threejs-shaders`, `threejs-textures`

### [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) · Apache-2.0 · 9

`figma`, `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `remotion-to-hyperframes`, `reverse-any-video`, `slideshow`, `style-sampling`

### [kajisho5/ffmpeg-skill](https://github.com/kajisho5/ffmpeg-skill) · MIT · 1

`ffmpeg-skill`

### [kurbaitaev/ghost-editor](https://github.com/kurbaitaev/ghost-editor) · MIT · 1

`ghost-editor`

### [ychoi-kr/claude-ffmpeg-skill](https://github.com/ychoi-kr/claude-ffmpeg-skill) · MIT · 1

`ffmpeg-usage`

### [iart-ai/ad-video-skills](https://github.com/iart-ai/ad-video-skills) · MIT · 3

`ad-creative-video`, `launch-video`, `testimonial-video`

### [iart-ai/b-roll-skills](https://github.com/iart-ai/b-roll-skills) · MIT · 1

`talking-head-b-roll`

### [iart-ai/data-animation-skills](https://github.com/iart-ai/data-animation-skills) · MIT · 3

`animated-infographic`, `chart-animation`, `presentation-video`

### [iart-ai/ecommerce-video-skills](https://github.com/iart-ai/ecommerce-video-skills) · MIT · 3

`photo-slideshow`, `product-demo-video`, `promo-video`

### [iart-ai/explainer-video-skills](https://github.com/iart-ai/explainer-video-skills) · MIT · 5

`diagram-animation`, `explainer-video`, `isometric-animation`, `whiteboard-animation`, `wrapped-video`

### [iart-ai/freelance-motion-skills](https://github.com/iart-ai/freelance-motion-skills) · MIT · 5

`brand-motion-guidelines`, `client-revisions`, `creative-brief`, `motion-pricing`, `video-delivery-specs`

### [iart-ai/javascript-animation-skills](https://github.com/iart-ai/javascript-animation-skills) · MIT · 2

`javascript-animation`, `soundtrack`

### [iart-ai/kinetic-typography-skills](https://github.com/iart-ai/kinetic-typography-skills) · MIT · 1

`kinetic-typography`

### [iart-ai/lower-thirds-skills](https://github.com/iart-ai/lower-thirds-skills) · MIT · 1

`lower-thirds`

### [iart-ai/manim-skills](https://github.com/iart-ai/manim-skills) · MIT · 1

`manim`

### [iart-ai/map-animation-skills](https://github.com/iart-ai/map-animation-skills) · MIT · 1

`map-animation`

### [iart-ai/motion-design-skills](https://github.com/iart-ai/motion-design-skills) · MIT · 9

`after-effects`, `animation-principles`, `beat-sync-editing`, `color-motion`, `logo-animation`, `motion-art-direction`, `motion-background`, `remotion-video`, `shot-composition`

### [iart-ai/talking-head-skills](https://github.com/iart-ai/talking-head-skills) · MIT · 1

`talking-head`

### [iart-ai/text-message-video-skills](https://github.com/iart-ai/text-message-video-skills) · MIT · 1

`text-message-animation`

### [iart-ai/tiktok-video-skills](https://github.com/iart-ai/tiktok-video-skills) · MIT · 4

`caption-animation`, `countdown-video`, `short-form-video`, `tiktok-lower-thirds`

### [iart-ai/web-animation-skills](https://github.com/iart-ai/web-animation-skills) · MIT · 9

`60fps-animation`, `accessible-animation`, `ascii-animation`, `glassmorphism`, `gsap-web`, `lottie-animation`, `micro-interaction`, `page-transition-animation`, `svg-animation`

### [iart-ai/webgl-animation-skills](https://github.com/iart-ai/webgl-animation-skills) · MIT · 3

`particle-system`, `shader-glsl`, `webgl-threejs-animation`

### [iart-ai/youtube-video-skills](https://github.com/iart-ai/youtube-video-skills) · MIT · 2

`audiogram`, `youtube-intro-outro`
