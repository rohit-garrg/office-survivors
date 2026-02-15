#!/bin/bash
set -e
# deploy.sh - Build game and copy to Astro site
# Usage: ./deploy.sh /path/to/rohitgarrg.com

SITE_DIR="${1:?Usage: ./deploy.sh /path/to/rohitgarrg.com}"
GAME_DIR="$SITE_DIR/public/projects/office-survivors"
ASTRO_PAGE="$SITE_DIR/src/pages/projects/office-survivors.astro"

echo "Building game..."
npm run build

if [ $? -ne 0 ]; then
  echo "Build failed. Aborting deploy."
  exit 1
fi

echo "Copying game build to $GAME_DIR..."
rm -rf "$GAME_DIR"
mkdir -p "$GAME_DIR"
cp -r dist/* "$GAME_DIR/"

# Astro iframe expects game.html (not index.html) to avoid path collision
# with the Astro route at /projects/office-survivors/
mv "$GAME_DIR/index.html" "$GAME_DIR/game.html"

# Check if Astro embed page exists
if [ ! -f "$ASTRO_PAGE" ]; then
  echo ""
  echo "WARNING: Astro embed page not found at $ASTRO_PAGE"
  echo "You need to create the embed page manually."
  echo "See CLAUDE.md 'Astro Embed Page Template' section."
fi

echo ""
echo "Done. Game deployed to $GAME_DIR"
echo ""
echo "Next steps:"
echo "  1. cd $SITE_DIR"
echo "  2. npx astro build        (verify no errors)"
echo "  3. git add . && git commit -m 'Update Office Survivors'"
echo "  4. git push                (Vercel auto-deploys)"
