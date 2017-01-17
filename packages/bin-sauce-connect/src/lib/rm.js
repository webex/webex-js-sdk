import fs from 'fs';
import denodeify from 'denodeify';

const rm = denodeify(fs.unlink);
export default rm;
