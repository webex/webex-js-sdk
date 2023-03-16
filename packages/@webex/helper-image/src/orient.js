/* eslint-disable complexity */
/**
 * Rotates/flips the image on the canvas as per exif information
 * @param {Object} options(orientation: image exif orientation range from 1-8, img: Image object, x: start x-axis, y: start y-axis, width: width of the thumbnail, height: height of the thumbnail, ctx: canvas context)
 * @param {Object} file
 * @returns {Object}
 */
export function orient(options, file) {
  const {width, height, ctx, img, orientation, x, y} = options;

  if (file && file.orientation && file.orientation !== 1) {
    // explanation of orientation:
    // https://stackoverflow.com/questions/20600800/js-client-side-exif-orientation-rotate-and-mirror-jpeg-images
    switch (orientation) {
      case 2:
        // flip
        ctx.transform(-1, 0, 0, 1, width, 0);
        break;
      case 3:
        // rotateImage180
        ctx.transform(-1, 0, 0, -1, width, height);
        break;
      case 4:
        // rotate180AndFlipImage
        ctx.transform(1, 0, 0, -1, 0, height);
        break;
      case 5:
        // rotate90AndFlipImage
        ctx.transform(0, 1, 1, 0, 0, 0);
        break;
      case 6:
        // rotateImage90
        ctx.transform(0, 1, -1, 0, height, 0);
        break;
      case 7:
        // rotateNeg90AndFlipImage
        ctx.transform(0, -1, -1, 0, height, width);
        break;
      case 8:
        // rotateNeg90
        ctx.transform(0, -1, 1, 0, 0, width);
        break;
      default:
        break;
    }
  }
  ctx.drawImage(img, x, y, width, height);
}
