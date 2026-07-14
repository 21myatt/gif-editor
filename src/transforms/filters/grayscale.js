export const grayscaleTransform = {
  id: 'grayscale',
  label: 'Grayscale',
  description: 'Converts the rendered frame to grayscale.',
  apply(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < image.data.length; index += 4) {
      const value = Math.round(image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
    }
    ctx.putImageData(image, 0, 0);
  }
};
