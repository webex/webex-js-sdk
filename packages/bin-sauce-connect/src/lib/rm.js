import denodeify from 'denodeify';
import fs from 'fs';

const rm = denodeify(fs.unlink);
export default rm;
