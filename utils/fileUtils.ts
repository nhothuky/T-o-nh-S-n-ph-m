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
  subtitleOptions?: SubtitleOptions
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

      canvas.width = baseImage.naturalWidth;
      canvas.height = baseImage.naturalHeight;
      ctx.drawImage(baseImage, 0, 0);

      const validParts = titleParts.filter(p => p.text && p.text.trim() !== '');
      if (validParts.length === 0) {
        resolve(baseImageSrc);
        return;
      }
      
      const fullText = validParts.map(p => p.text.toUpperCase()).join(' ');

      const maxWidth = canvas.width - 80;
      let fontSize = 200;
      
      // Calculate the optimal font size to fit the full text
      while (fontSize > 10) {
        // Use a heavier font weight for a bolder look
        ctx.font = `800 ${fontSize}px ${fontFamily}`;
        if (ctx.measureText(fullText).width <= maxWidth) {
          break;
        }
        fontSize--;
      }

      // Set the final font style
      ctx.font = `800 ${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'top';
      
      // Calculate starting position to center the entire line
      const totalWidth = ctx.measureText(fullText).width;
      let currentX = (canvas.width - totalWidth) / 2;
      const y = 25;

      // Draw each part sequentially to build the full title
      validParts.forEach((part, index) => {
        const partText = part.text.toUpperCase();
        
        // 3D Block Effect
        // Calculate the depth of the 3D effect based on the font size.
        const depth = Math.max(2, Math.ceil(fontSize / 35));

        // Draw the extrusion/shadow layer multiple times, offset diagonally.
        // This creates the illusion of depth.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        for (let i = 1; i <= depth; i++) {
          ctx.fillText(partText, currentX + i, y + i);
        }
        
        // Add a soft drop shadow for better contrast and pop
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = Math.max(5, fontSize / 15); // Scale blur with font size
        const shadowOffset = Math.max(2, fontSize / 40); // Scale offset
        ctx.shadowOffsetX = shadowOffset;
        ctx.shadowOffsetY = shadowOffset;
        
        // Draw the main, top layer of the text with the user-selected color.
        ctx.fillStyle = part.color;
        ctx.fillText(partText, currentX, y);
        
        // Reset shadow properties to avoid affecting other elements
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Move the horizontal position for the next part of the title
        currentX += ctx.measureText(partText).width;
        
        // Add space width if it's not the last part
        if (index < validParts.length - 1) {
          currentX += ctx.measureText(' ').width;
        }
      });
      
      // Draw subtitle if provided
      if (subtitleOptions && subtitleOptions.text.trim() !== '') {
          const subtitleText = subtitleOptions.text;
          const subtitleFontSize = Math.max(20, fontSize * 0.4); // Ensure a minimum size
          ctx.font = `600 ${subtitleFontSize}px ${fontFamily}`; // Slightly less bold
          
          const subtitleWidth = ctx.measureText(subtitleText).width;
          const subtitleX = (canvas.width - subtitleWidth) / 2;
          // Position it below the main title with some padding
          const subtitleY = y + fontSize + (fontSize * 0.1);

          // Add a simple, clean shadow for readability
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 5;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;

          ctx.fillStyle = subtitleOptions.color;
          ctx.fillText(subtitleText, subtitleX, subtitleY);

          // Reset shadow again
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


export const applyWatermark = (baseImageSrc: string, watermarkFile: File, opacity: number): Promise<string> => {
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
        const watermarkWidth = 200;
        const watermarkHeight = 200;
        const padding = 10;
        const x = canvas.width - watermarkWidth - padding;
        const y = canvas.height - watermarkHeight - padding;

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