# Tanum InfoScreen – Delete control and fast refresh

- Permanent delete removes the post from KV.
- Pausing hides the post from the TV.
- TV polls for changes every 5 seconds.
- Keeps the existing `INFO_KV` binding and stored posts.

Deploy by replacing `worker.js` in the existing `tanum-infoscreen` GitHub repository. Do not change the separate `lysekil-buss` project.
