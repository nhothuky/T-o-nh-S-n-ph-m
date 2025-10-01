import { GoogleGenAI, Modality } from "@google/genai";
import { fileToBase64 } from '../utils/fileUtils';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface BackgroundOptions {
  style: 'default' | 'solid' | 'gradient' | 'blur' | 'upload';
  color1?: string;
  color2?: string;
  backgroundImage?: File | null;
}

const generatePrompt = (options: BackgroundOptions, aspectRatio: string): string => {
  let backgroundInstruction = '';
  switch (options.style) {
    case 'solid':
      backgroundInstruction = `sử dụng một nền màu trơn, sạch sẽ có mã màu ${options.color1 || '#FFFFFF'}`;
      break;
    case 'gradient':
      backgroundInstruction = `sử dụng một nền gradient chuyển từ màu ${options.color1 || '#4ade80'} sang màu ${options.color2 || '#3b82f6'}`;
      break;
    case 'blur':
      backgroundInstruction = 'giữ lại nền gốc nhưng làm mờ nó đi để làm nổi bật sản phẩm';
      break;
    case 'upload':
      backgroundInstruction = 'đặt sản phẩm từ hình ảnh đầu tiên vào nền được cung cấp trong hình ảnh thứ hai';
      break;
    case 'default':
    default:
      backgroundInstruction = 'sử dụng một nền gradient màu xanh ngọc sạch sẽ, chuyên nghiệp';
      break;
  }
  
  return `Chỉnh sửa ảnh sản phẩm này. Giữ nguyên sản phẩm và góc nhìn. Thay thế nền theo hướng dẫn sau: ${backgroundInstruction}. Cải thiện ánh sáng để trông chuyên nghiệp như chụp trong studio, thêm bóng đổ và phản chiếu nhẹ nhàng để sản phẩm trông chân thực. Nâng cao chất lượng tổng thể của hình ảnh. Xuất ảnh với tỷ lệ khung hình ${aspectRatio}.`;
};

export const enhanceImage = async (file: File, options: BackgroundOptions, aspectRatio: string): Promise<string> => {
  try {
    const { base64Data: productBase64, mimeType: productMimeType } = await fileToBase64(file);
    const prompt = generatePrompt(options, aspectRatio);

    // For image editing models, image parts should come before the text prompt.
    const parts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[] = [
      {
        inlineData: {
          data: productBase64,
          mimeType: productMimeType,
        },
      }
    ];

    if (options.style === 'upload' && options.backgroundImage) {
      const { base64Data: backgroundBase64, mimeType: backgroundMimeType } = await fileToBase64(options.backgroundImage);
      parts.push({
        inlineData: {
          data: backgroundBase64,
          mimeType: backgroundMimeType,
        },
      });
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
        // System instruction to prevent the model from outputting conversational text.
        systemInstruction: "Bạn là một công cụ chỉnh sửa ảnh AI. Chỉ trả về hình ảnh đã được chỉnh sửa theo yêu cầu. Không bao giờ thêm bất kỳ văn bản, lời giải thích hay lời nói đầu nào vào phản hồi của bạn. Nhiệm vụ duy nhất của bạn là tạo ra kết quả hình ảnh.",
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    // Improved error checking to provide more specific feedback to the user.
    if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];

        // Check if the request was blocked (e.g., for safety reasons).
        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
            throw new Error(`Yêu cầu đã bị chặn vì lý do: ${candidate.finishReason}. Vui lòng thử một hình ảnh hoặc tùy chọn khác.`);
        }

        if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data; // Success, return the image data.
                }
            }
            // If we get here, no image was found. Check for a text response.
            const textParts = candidate.content.parts.filter(p => p.text).map(p => p.text);
            if (textParts.length > 0) {
                const textResponse = textParts.join(' ').trim();
                throw new Error(`API không trả về hình ảnh mà trả về văn bản: "${textResponse}".`);
            }
        }
    }

    // If we get here, no image was found in the response for other reasons.
    throw new Error("API không trả về hình ảnh. Yêu cầu có thể đã bị từ chối hoặc không hợp lệ.");

  } catch (error) {
    console.error("Error enhancing image with Gemini API:", error);
    if (error instanceof Error) {
        // Propagate a user-friendly error message.
        throw new Error(`Lỗi API Gemini: ${error.message}`);
    }
    throw new Error("Đã xảy ra lỗi không xác định trong quá trình nâng cấp ảnh.");
  }
};