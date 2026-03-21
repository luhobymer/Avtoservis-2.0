export async function compressImageFile(file, maxWidth = 1600, maxHeight = 1600, quality = 0.8) {
  if (!(file instanceof File)) {
    return file;
  }
  const imageUrl = URL.createObjectURL(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });
  try {
    const { width, height } = image;
    let targetWidth = width;
    let targetHeight = height;
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      targetWidth = Math.round(width * ratio);
      targetHeight = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const blob = await new Promise((resolve) => {
      canvas.toBlob(
        (result) => {
          resolve(result || file);
        },
        'image/jpeg',
        quality
      );
    });
    if (!(blob instanceof Blob)) {
      return file;
    }
    const compressedFile = new File([blob], file.name || 'image.jpg', {
      type: blob.type || 'image/jpeg',
      lastModified: Date.now()
    });
    return compressedFile;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

