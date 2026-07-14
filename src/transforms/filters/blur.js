export const blurTransform = {
  id: 'blur',
  label: 'Blur',
  description: 'Applies a light blur to the rendered frame.',
  apply(canvas) {
    const ctx = canvas.getContext('2d');
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext('2d').drawImage(canvas, 0, 0);
    ctx.save();
    ctx.filter = 'blur(1px)';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(copy, 0, 0);
    ctx.restore();
  }
};
