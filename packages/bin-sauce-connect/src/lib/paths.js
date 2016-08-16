import path from 'path';

export const dotSauce = path.join(__dirname, `..`, `..`, `..`, `..`, `.sauce`);
export const logFile = path.join(dotSauce, `sauce_connect${process.env.PACKAGE ? `.${process.env.PACKAGE}` : ``}.log`);
export const pidFile = path.join(dotSauce, `sc${process.env.PACKAGE ? `.${process.env.PACKAGE}` : ``}.pid`);
export const readyFile = path.join(dotSauce, `sc${process.env.PACKAGE ? `.${process.env.PACKAGE}` : ``}.ready`);
