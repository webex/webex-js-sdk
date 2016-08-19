#!/bin/bash


find ./reports -type f | xargs ls -lh | awk '{print $5 "," $6 " " $7 " " $8 "," $9}' > artifacts.csv
gzip -r ./reports
mv artifacts.csv ./reports/artifacts.csv
