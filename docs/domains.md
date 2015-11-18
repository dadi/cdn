![Barbu](../barbu.png)

# Multi-domain support

## Overview

Barbu has support for multiple domains: the ability to listen and respond on a domain by domain basis.

This allows a single instance or cluster to deliver different media for different domains (domainone.com and domaintwo.com for example).

## Setup

Multiple domain support is facilitated via the addition of configuration files within `/workspace/domain-loader`.

Configuration files should be named by domain and by environment, for example:

- domain1.com.config.development.json
- domain1.com.config.qa.json
- domain1.com.config.production.json
- domain2.com.config.development.json
- domain2.com.config.qa.json
- domain2.com.config.production.json
- Etc.

All of the settings within the configuration files in `/workspace/domain-loader` supercede the settngs within the main configuration file. This allows for independant per-domain caching, API functionality and file loading.
