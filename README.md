# Bullis Mission Control — Release 1.3

A standalone, installable Progressive Web App for personal mission management.

## Included features
- Mission dashboard and progress tracking
- Editable mission list
- Rachel mission-advisor messaging
- Notes with supported-browser voice dictation
- Local browser storage
- JSON backup and restore
- Offline caching through a service worker
- Installable PWA manifest
- Responsive phone/desktop layout

## Deployment
Upload the CONTENTS of this folder—not the outer folder itself—to the root of a Netlify site.
The root of the deployed package must contain `index.html`.

## Local testing
Service workers require HTTP/HTTPS. From this folder, run:

    python -m http.server 8080

Then visit `http://localhost:8080`.

## Release
Version: 1.3
Company: Bullis AI Solutions
Product: Bullis Mission Control
