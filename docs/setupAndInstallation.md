# DADI CDN

## Setup and installation

`$ [sudo] git clone https://github.com/dadi/cdn.git`

`$ cd cdn`

### Installing dependencies

To ensure your system has all the required dependencies, run the following command:

`$ [sudo] npm install`

### Running tests

The inclusion of opperational tests is work in progress. Watch this space.

### Starting the server

To start DADI CDN, issue the following command. This will start the server using the configuration settings found in the config.json file.

`$ [sudo] npm start`

#### Running the server in the background and as a service

Pro tip: to run DADI CDN in the background, install [Forever](https://github.com/nodejitsu/forever) and [Forever-service](https://github.com/zapty/forever-service)

`[sudo] npm install forever -g`

`[sudo] npm install -g forever-service`

install DADI CDN as a service and ensure it loads on boot:

`[sudo] forever-service install -s dadi/main.js cdn --start`

You can then interact with CDN as a service using the following command:

- Start: `[sudo] start cdn`
- Stop: `[sudo] stop cdn`
- Status: `[sudo] status cdn`
- Restart `[sudo] restart cdn`

### Additional reading

You can see a complete installation guide for DADI CDN under Ubuntu [here](https://github.com/dadi/cdn/blob/docs/installGuide.ubuntu.md).
