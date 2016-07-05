# DADI CDN

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/cdn.svg?maxAge=10800&style=flat-square)](https://www.npmjs.com/package/@dadi/cdn)&nbsp;[![coverage](https://img.shields.io/badge/coverage-76%25-yellow.svg?style=flat-square)](https://github.com/dadi/cdn)&nbsp;[![Build](http://ci.dadi.technology/dadi/cdn/badge?branch=master&service=shield)](http://ci.dadi.technology/dadi/cdn)

## Overview

DADI CDN is built on Node.JS, with support for S3 and Redis. It is a high performance, just-in-time asset manipulation and delivery layer designed as a modern content distribution solution.

You can consider a full installation of DADI CDN as being analogous to a traditional CDN (Content Distribution Network) such as Akamai or Limelight. It is designed to carry the processing and delivery load associated with image manipulation and asset delivery (CSS/JS/fonts). It acts autonomously as a layer on top of your core product.

It has full support for caching, header control, image manipulation, image compression and image format conversion. An authenticated API allows for fine grained cache control in the form of content invalidation on an individual file or collective path basis.

CDN is part of DADI, a suite of components covering the full development stack, built for performance and scale.

## Mac OS X

Please follow the instructions here: https://github.com/Automattic/node-canvas/wiki/Installation---OSX

### Troubleshooting

Most problems can be solved by using Homebrew and running `brew install cairo`



## Licence

DADI is a data centric development and delivery stack, built specifically in support of the principles of API first and COPE.

Copyright notice<br />
(C) 2016 DADI+ Limited <support@dadi.tech><br />
All rights reserved

This product is part of DADI.<br />
DADI is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version ("the AGPL").

**If you wish to use DADI outside the scope of the AGPL, please
contact us at info@dadi.co for details of alternative licence
arrangements.**

**This product may be distributed alongside other components
available under different licences (which may not be AGPL). See
those components themselves, or the documentation accompanying
them, to determine what licences are applicable.**

DADI is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

The GNU Affero General Public License (AGPL) is available at
http://www.gnu.org/licenses/agpl-3.0.en.html.<br />
A copy can be found in the file AGPL.md distributed with
these files.

This copyright notice MUST APPEAR in all copies of the product!
