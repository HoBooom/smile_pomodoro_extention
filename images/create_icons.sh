#!/bin/bash

# This script creates simple placeholder icons for the Chrome extension
# It requires ImageMagick to be installed

# Create 16x16 icon
convert -size 16x16 radial-gradient:blue-white images/icon16.png

# Create 48x48 icon
convert -size 48x48 radial-gradient:blue-white images/icon48.png

# Create 128x128 icon
convert -size 128x128 radial-gradient:blue-white images/icon128.png

echo "Icons created in images directory" 