# Pets

Drop image files in here — `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.

They are picked up automatically at build time, in filename order, and shown
in the "Super important documents" folder. Nothing else needs editing: no
imports, no list to update. Delete a file and it disappears from the folder.

If this directory is empty the folder falls back to the drawn pixel pets, so
the joke still works on a fresh checkout.

Use photos you own or that are licensed for it. This ends up on a public site.

Keep them small — resize to about 800px on the long edge and save as WebP:

    magick cat.jpg -resize 800x800 -quality 82 cat.webp

Four 1.5MB phone photos would be five times the weight of the entire rest of
the app.
