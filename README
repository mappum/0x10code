# 0x10co.de - Makes sharing 0x10c code easy!

Uses MongoDB and Express.

Make sure you have nodejs, mongodb and npm installed on your machine.

## Install Software

### Ubuntu/Debian

    sudo apt-get install nodejs mongodb

### Other Distros.

Install or compile Node.JS (http://nodejs.org/) and MongoDB (http://www.mongodb.org/)

### Install Node Package Manager

Obviously skip this if you already have npm installed

    curl http://npmjs.org/install.sh | sudo sh

### Install Required Node.JS Packages

    npm install

### Configure

Copy the example configuration and modify to suit your environment (if needed).

    cp config_example.js config.js
    vim config.js

## Run

    node app.js

## Setup as Ubuntu Upstart Service

This service example uses supervisor to keep the process alive.

    sudo npm install supervisor -g
    sudo cp ubuntu.upstart.conf /etc/init/0x10code.conf
    sudo vim /etc/init/0x10code.conf

Modify the server path and the execution user accordingly. You will now be able to start/top the server using:

    start 0x10code
    stop 0x10code

The default setup is to start the server automatically upon server startup. You can change these instructions in the 0x10code.conf file.
