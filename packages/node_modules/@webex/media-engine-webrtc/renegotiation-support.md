# Renegotiation Support

Due to the way different browsers handle sdp creation during renegotiation,
our implementation requires us to skip some tests for different scenarios.

## Firefox (as of v59)

### Firefox Audio

|              | start inactive | start recvonly | start sendonly | start sendrecv |
| ------------ | -------------- | -------------- | -------------- | -------------- |
| end inactive | N/A            | Good           | SKIP *fa1*     | SKIP *fa2*     |
| end recvonly | Good           | N/A            | SKIP *fa1*     | SKIP *fa2*     |
| end sendonly | SKIP *fa1*     | Good           | N/A            | Good           |
| end sendrecv | Good           | Good           | SKIP *fa1*     | N/A            |

[fa1]: sendonly creates a sendrecv track `expected 'sendrecv' to equal 'sendonly'`
[fa2]: transitioning back from inactive causes there to be two audio media sections (recvonly & sendonly)

### Firefox Video

|              | start inactive | start recvonly | start sendonly | start sendrecv |
| ------------ | -------------- | -------------- | -------------- | -------------- |
| end inactive | N/A            | Good           | SKIP *fv1*     | SKIP *fv2*     |
| end recvonly | Good           | N/A            | SKIP *fv1*     | SKIP *fv2*     |
| end sendonly | SKIP *fv1*     | Good           | N/A            | Good           |
| end sendrecv | Good           | Good           | SKIP *fv1*     | N/A            |

[fv1]: sendonly creates a sendrecv track `expected 'sendrecv' to equal 'sendonly'`
[fv2]: transitioning back from inactive causes there to be two audio media sections (recvonly & sendonly)

## Chrome

### Chrome Audio

|              | start inactive | start recvonly | start sendonly | start sendrecv |
| ------------ | -------------- | -------------- | -------------- | -------------- |
| end inactive | N/A            | SKIP           | SKIP           | SKIP           |
| end recvonly | SKIP           | N/A            | SKIP           | Good           |
| end sendonly | SKIP           | Good           | N/A            | Good           |
| end sendrecv | SKIP           | Good           | SKIP           | N/A            |

### Chrome Video

|              | start inactive | start recvonly | start sendonly | start sendrecv |
| ------------ | -------------- | -------------- | -------------- | -------------- |
| end inactive | N/A            | Good           | Good           | Good           |
| end recvonly | Good           | N/A            | SKIP           | Good           |
| end sendonly | Good           | Good           | N/A            | Good           |
| end sendrecv | Good           | Good           | SKIP           | N/A            |
