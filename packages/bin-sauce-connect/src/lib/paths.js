import path from 'path';

export const dotSauce = path.join(__dirname, `..`, `..`, `..`, `..`, `.sauce${process.env.PACKAGE ? `/${process.env.PACKAGE}` : ``}`);
export const logFile = path.join(dotSauce, `sauce_connect.log`);
export const pidFile = path.join(dotSauce, `sc.pid`);
export const readyFile = path.join(dotSauce, `sc.ready`);
