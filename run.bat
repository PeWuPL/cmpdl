@echo off
node %~dp0index.js -i "%~1" -o "%~dp0download/"
pause