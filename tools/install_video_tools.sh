#!/usr/bin/env bash
# Sets up the video tools that are not stored in this repo, for the current session only.
#   bash tools/install_video_tools.sh
# - yt-dlp and openai-whisper: Python packages (installed with pip).
# - Two Claude skills with no open licence, so they are downloaded rather than committed here:
#   mattypark/Motion-graphics-skill (motion-video-director) and iart-ai/generative-illustration-skills.
#   They go into ~/.claude/skills, which is personal to this machine.
set -e
pip install -q torch --index-url https://download.pytorch.org/whl/cpu || true   # CPU build of PyTorch for Whisper: far smaller, cloud sessions have no GPU
pip install -q --upgrade yt-dlp openai-whisper
tmp=$(mktemp -d)
git clone -q --depth 1 https://github.com/mattypark/Motion-graphics-skill.git "$tmp/mg"
git clone -q --depth 1 https://github.com/iart-ai/generative-illustration-skills.git "$tmp/gi"
mkdir -p ~/.claude/skills
for d in "$tmp"/mg/skills/*/ "$tmp"/gi/skills/*/; do
  n=$(basename "$d"); rm -rf ~/.claude/skills/"$n"; cp -r "$d" ~/.claude/skills/"$n"; echo "skill: $n"
done
rm -rf "$tmp"
echo "yt-dlp $(yt-dlp --version), whisper installed"
