# PWA Icons

This directory should contain PWA icons for the Emergency Services Locator app.

## Required Icons

The following icon sizes are required for full PWA support:

- `icon-72x72.png` - 72x72 pixels
- `icon-96x96.png` - 96x96 pixels  
- `icon-128x128.png` - 128x128 pixels
- `icon-144x144.png` - 144x144 pixels
- `icon-152x152.png` - 152x152 pixels (iOS)
- `icon-192x192.png` - 192x192 pixels (Android)
- `icon-384x384.png` - 384x384 pixels
- `icon-512x512.png` - 512x512 pixels (Splash screen)

## Icon Generation

Icons can be created using:

1. **Online Tools:**
   - https://realfavicongenerator.net/
   - https://www.pwabuilder.com/imageGenerator
   - https://favicon.io/

2. **Design Guidelines:**
   - Use the ambulance emoji (🚑) or emergency cross symbol
   - Background color: #FF385C (primary red)
   - Make icons maskable (safe zone for rounded corners)

3. **Command Line (ImageMagick):**
   ```bash
   # Create base icon (512x512)
   convert -size 512x512 xc:#FF385C icon-512x512.png
   
   # Resize to other sizes
   convert icon-512x512.png -resize 192x192 icon-192x192.png
   convert icon-512x512.png -resize 152x152 icon-152x152.png
   ```

## Development Notes

Placeholder icons or simple colored squares can be used during development. The app functions without icons, but PWA installation requires proper icon files.

## Note

Icons are referenced in `manifest.json`. Make sure all icon files exist in this directory for full PWA functionality.

