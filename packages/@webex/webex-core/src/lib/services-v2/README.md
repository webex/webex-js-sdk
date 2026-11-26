[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Services plugin for the U2CV2 catalog format. This is the default `services` plugin; the v1 plugin in `/services` is still exported for apps that register it themselves.

Accepted cached hostmaps restore active service mappings and the service list before catalog readiness, so service-name resolution and host helpers work after a reload with `calling.cacheU2C` enabled. Both bare and wrapped cache entries remain supported.

Configured `services.override` URLs take precedence over discovered active-cluster URLs for unscoped lookups. A lookup with an explicit service group continues to search only that group.
