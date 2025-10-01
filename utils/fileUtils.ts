export const fileToBase64 = (file: File): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // The result from readAsDataURL is a data URL like "data:image/png;base64,iVBORw0..."
      // We need to extract just the base64 part.
      const base64Data = result.split(',')[1];
      if (base64Data) {
        resolve({ base64Data, mimeType: file.type });
      } else {
        reject(new Error("Failed to read file as Base64."));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export interface SubtitleOptions {
  text: string;
  color: string;
}

export const applyTitle = (
  baseImageSrc: string,
  titleParts: Array<{ text: string; color: string }>,
  fontFamily: string,
  subtitleOptions: SubtitleOptions | undefined,
  aspectRatio: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const baseImage = new Image();
    baseImage.crossOrigin = 'anonymous';
    baseImage.src = baseImageSrc;

    baseImage.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context.'));
      }

      // --- START: ASPECT RATIO ENFORCEMENT LOGIC ---
      const [targetW, targetH] = aspectRatio.split(':').map(Number);
      if (!targetW || !targetH) {
          return reject(new Error('Invalid aspect ratio format.'));
      }
      const targetRatio = targetW / targetH;
      const originalWidth = baseImage.naturalWidth;
      const originalHeight = baseImage.naturalHeight;
      const originalRatio = originalWidth / originalHeight;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = originalWidth;
      let sourceHeight = originalHeight;

      if (originalRatio > targetRatio) {
        // Original image is wider than target, crop sides (cinematic style)
        sourceWidth = originalHeight * targetRatio;
        sourceX = (originalWidth - sourceWidth) / 2;
      } else if (originalRatio < targetRatio) {
        // Original image is taller than target, crop top/bottom
        sourceHeight = originalWidth / targetRatio;
        sourceY = (originalHeight - sourceHeight) / 2;
      }
      
      // Set canvas to the final cropped dimensions
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      // Draw the cropped portion of the original image onto the canvas
      ctx.drawImage(
        baseImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
      // --- END: ASPECT RATIO ENFORCEMENT LOGIC ---

      const validParts = titleParts.filter(p => p.text && p.text.trim() !== '');
      const hasTitle = validParts.length > 0;
      const hasSubtitle = subtitleOptions && subtitleOptions.text.trim() !== '';

      if (!hasTitle && !hasSubtitle) {
        // If no text, just resolve with the cropped image.
        resolve(canvas.toDataURL('image/png'));
        return;
      }
      
      let titleHeight = 0;
      let titleFontSize = 0;
      
      if (hasTitle) {
        const fullText = validParts.map(p => p.text.toUpperCase()).join(' ');
        const maxWidth = canvas.width - 80;
        let fontSize = 200;
        while (fontSize > 10) {
            ctx.font = `800 ${fontSize}px ${fontFamily}`;
            if (ctx.measureText(fullText).width <= maxWidth) {
                break;
            }
            fontSize--;
        }
        titleFontSize = fontSize;
        titleHeight = titleFontSize;
        
        ctx.font = `800 ${titleFontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';
        const totalWidth = ctx.measureText(fullText).width;
        let currentX = (canvas.width - totalWidth) / 2;
        const y = 25;

        validParts.forEach((part, index) => {
            const partText = part.text.toUpperCase();
            
            const depth = Math.max(2, Math.ceil(titleFontSize / 35));
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            for (let i = 1; i <= depth; i++) {
              ctx.fillText(partText, currentX + i, y + i);
            }
            
            ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
            ctx.shadowBlur = Math.max(5, titleFontSize / 15);
            const shadowOffset = Math.max(2, titleFontSize / 40);
            ctx.shadowOffsetX = shadowOffset;
            ctx.shadowOffsetY = shadowOffset;
            
            ctx.fillStyle = part.color;
            ctx.fillText(partText, currentX, y);
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            currentX += ctx.measureText(partText).width;
            if (index < validParts.length - 1) {
              currentX += ctx.measureText(' ').width;
            }
        });
      }
      
      if (hasSubtitle) {
          const subtitleText = subtitleOptions.text;
          const baseSize = hasTitle ? titleFontSize : canvas.height * 0.1;
          const subtitleFontSize = Math.max(20, baseSize * 0.4);
          ctx.font = `600 ${subtitleFontSize}px ${fontFamily}`;
          
          const subtitleWidth = ctx.measureText(subtitleText).width;
          const subtitleX = (canvas.width - subtitleWidth) / 2;
          const subtitleY = 25 + (hasTitle ? titleHeight + (titleHeight * 0.1) : 0);

          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 5;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = subtitleOptions.color;
          ctx.fillText(subtitleText, subtitleX, subtitleY);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
      }

      resolve(canvas.toDataURL('image/png'));
    };

    baseImage.onerror = (error) => reject(error);
  });
};

export type WatermarkPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export const applyWatermark = (
  baseImageSrc: string,
  watermarkFile: File,
  opacity: number,
  position: WatermarkPosition = 'bottomRight',
  size: number = 0.15 // Default size 15%
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const baseImage = new Image();
    baseImage.crossOrigin = 'anonymous';
    baseImage.src = baseImageSrc;

    baseImage.onload = () => {
      const watermarkImage = new Image();
      watermarkImage.crossOrigin = 'anonymous';
      const watermarkUrl = URL.createObjectURL(watermarkFile);
      watermarkImage.src = watermarkUrl;

      watermarkImage.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(watermarkUrl);
          return reject(new Error('Could not get canvas context.'));
        }

        canvas.width = baseImage.naturalWidth;
        canvas.height = baseImage.naturalHeight;

        // Draw the base image
        ctx.drawImage(baseImage, 0, 0);

        // Set watermark properties
        ctx.globalAlpha = opacity;

        // Calculate watermark dimensions based on size percentage of base image width
        const watermarkAspectRatio = watermarkImage.naturalWidth / watermarkImage.naturalHeight;
        const watermarkWidth = baseImage.naturalWidth * size;
        const watermarkHeight = watermarkWidth / watermarkAspectRatio;
        
        const padding = 20;

        let x: number;
        let y: number;

        switch (position) {
          case 'topLeft':
            x = padding;
            y = padding;
            break;
          case 'topRight':
            x = canvas.width - watermarkWidth - padding;
            y = padding;
            break;
          case 'bottomLeft':
            x = padding;
            y = canvas.height - watermarkHeight - padding;
            break;
          case 'bottomRight':
          default:
            x = canvas.width - watermarkWidth - padding;
            y = canvas.height - watermarkHeight - padding;
            break;
        }

        // Draw the watermark
        ctx.drawImage(watermarkImage, x, y, watermarkWidth, watermarkHeight);

        // Clean up
        URL.revokeObjectURL(watermarkUrl);

        // Resolve with the new data URL
        resolve(canvas.toDataURL('image/png'));
      };

      watermarkImage.onerror = (error) => {
        URL.revokeObjectURL(watermarkUrl);
        reject(error);
      };
    };

    baseImage.onerror = (error) => reject(error);
  });
};