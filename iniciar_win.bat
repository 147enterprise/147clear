@echo off

if not exist "node_modules\" (
    npm install & start cmd /k "node %cd%\index.js" & exit
)

start cmd /k "node %cd%\index.js"
exit
