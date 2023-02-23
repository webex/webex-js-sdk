## Introduction


Some of the customer networks has restrictions on ports UDP 5004, UDP 9000 and TCP 5004 are blocked by the customer's firewall, Meetings SDK based apps cannot establish media connection in those cases. 

## Pre-requisites

Please ensure the SDK version is `webex-js-sdk@2.38.0` or above.

## Solution


Rather than routing the meeting over the above ports, media will flow over TLS 443 port by connecting to a TURN server, If all the ports are not reachable the client will fallback to TLS 443.


## Steps to disable 
  
By default, the TLS 443 is enabled for everyone, but if the customer experiences any issue, the feature can be turned off by using the below config when setting up the SDK.

```js
    meetings: {
      experimental: {
        enableTurnDiscovery: false,
      }
    },
```

## Testing

  To test TLS 443 you will need to disable the following ports on your local machine firewall and make a call.

### Mac Machine

Edit /etc/pf.conf file and append to it the following lines

```
block out proto udp from any to any port 5004
block out proto udp from any to any port 9000
block out proto tcp from any to any port 5004
block out proto tcp from any to any port 9000 
```

Then run the following command

```
sudo pfctl -f /etc/pf.conf && sudo pfctl -e 
```

Vidcast : https://app.vidcast.io/share/53d1e91d-55f0-4063-bdef-b4c35beae673

