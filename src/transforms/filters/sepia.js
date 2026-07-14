export const sepiaTransform = {
  id: 'sepia',
  label: 'Sepia',
  description: 'Applies a warm sepia tone to the rendered frame.',
  apply(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < image.data.length; index += 4) {
      const red = image.data[index];
      const green = image.data[index + 1];
      const blue = image.data[index + 2];
      image.data[index] = Math.min(255, Math.round(red * 0.393 + green * 0.769 + blue * 0.189));
      image.data[index + 1] = Math.min(255, Math.round(red * 0.349 + green * 0.686 + blue * 0.168));
      image.data[index + 2] = Math.min(255, Math.round(red * 0.272 + green * 0.534 + blue * 0.131));
    }
    ctx.putImageData(image, 0, 0);
  }
};
