# Bullis Mission Control 2.2

Working BMC 2.0 foundation.

Included: Dashboard, Missions, Rachel, Calendar, Prayer, Notes, People, Backup/Restore, Offline PWA, and Azure-backed English voice features.

## Netlify deployment

- Branch: main
- Build command: blank
- Publish directory: blank

## Azure Speech setup

Create the following environment variables in your Netlify site configuration:

- AZURE_SPEECH_KEY
- AZURE_SPEECH_REGION

Set `AZURE_SPEECH_REGION` to `your-azure-region` in your environment configuration. The key is never stored in frontend JavaScript, HTML, CSS, Git history, logs, screenshots, or documentation examples.

A local example file is included at `.env.example` with placeholder values only.

## Local development

1. Copy `.env.example` to `.env` for local-only testing if your environment requires it.
2. Set the Azure values in your local environment or Netlify project settings.
3. Run the site locally with any static web server, or deploy to Netlify so the serverless functions can access the environment variables.

## Notes

- The app prefers Azure neural English voices.
- Browser speech synthesis remains available as an automatic fallback.
- Voice favorites and the selected voice are stored in localStorage on the device.
- The Azure voice catalog is loaded from the Netlify serverless endpoint and cached for six hours on the server.
