# DADI CDN

## Setup and installation

`$ [sudo] git clone https://github.com/bantam-framework/barbu.git`

`$ cd barbu`

### Installing dependencies

To ensure your system has all the required dependencies, run the following command:

`$ [sudo] npm install`

### Running tests

The inclusion of opperational tests is work in progress. Watch this space.

### Starting the server

To start Barbu, issue the following command. This will start the server using the configuration settings found in the config.json file.

`$ [sudo] npm start`

#### Running the server in the background and as a service

Pro tip: to run Barbu in the background, install [Forever](https://github.com/nodejitsu/forever) and [Forever-service](https://github.com/zapty/forever-service)

`[sudo] npm install forever -g`

`[sudo] npm install -g forever-service`

install barbu as a service and ensure it loads on boot:

`[sudo] forever-service install -s bantam/main.js barbu --start`

You can then interact with Barbu as a service using the following command:

- Start: `[sudo] start barbu`
- Stop: `[sudo] stop barbu`
- Status: `[sudo] status barbu`
- Restart `[sudo] restart barbu`

### Additional reading

You can see a complete installation guide for Barbu under Ubuntu [here](https://github.com/dadi/cdn/blob/docs/install.ubuntu.md).
