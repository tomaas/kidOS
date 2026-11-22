# Cursive reading font (optional, not bundled)

The optional "cursive" reading mode is designed for **Belle Allure GS** (Gros weight), a French school cursive typeface by Jean Boyault — JBFoundry (https://www.jbfoundry.com). It is a faithful école-cursive with real CP liaisons, built to teach the joined ("attachée") handwriting used in French maternelle/CP classrooms.

Belle Allure is **free for personal and educational use only** (commercial use requires a license from the author), so the font file is **not** distributed with this repository.

To enable it:

1. Download the "Belle Allure GS" (Gros) WOFF, e.g. from https://www.cdnfonts.com/belle-allure-cm.font
2. Save it here as `cursive.woff` (this exact name):

   ```
   public/fonts/cursive.woff
   ```

3. Restart the dev server.

Without the file, the cursive toggle still works — the browser falls back to a system cursive font (`Segoe Script` / `Snell Roundhand`), just less school-accurate.
