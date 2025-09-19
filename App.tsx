import React, { useState, useCallback, useEffect, useRef } from 'react';
import { enhanceImage, BackgroundOptions } from './services/geminiService';
import { applyWatermark, applyTitle, SubtitleOptions } from './utils/fileUtils';

const UploadIcon: React.FC<{className?: string}> = ({className = "w-12 h-12 mb-4 text-gray-500"}) => (
  <svg className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
  </svg>
);

const DownloadIcon: React.FC = () => (
    <svg className="w-6 h-6 mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
    </svg>
);

const Spinner: React.FC = () => (
  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
);

const ImageDisplay: React.FC<{ title: string; imageUrl: string | null; children?: React.ReactNode; isLoading?: boolean }> = ({ title, imageUrl, children, isLoading }) => (
  <div className="bg-gray-800 rounded-lg p-6 flex flex-col items-center justify-center w-full h-full min-h-[300px] md:min-h-[512px]">
    <h2 className="text-xl font-bold mb-4 text-gray-300">{title}</h2>
    <div className="w-full h-full flex items-center justify-center aspect-square bg-gray-900/50 rounded-md overflow-hidden">
      {isLoading ? (
        <Spinner />
      ) : imageUrl ? (
        <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
      ) : (
        children
      )}
    </div>
  </div>
);

const fontOptions = [
  { name: 'Be Vietnam Pro', family: "'Be Vietnam Pro', sans-serif" },
  { name: 'Montserrat', family: "'Montserrat', sans-serif" },
  { name: 'Oswald', family: "'Oswald', sans-serif" },
  { name: 'Pacifico', family: "'Pacifico', cursive" },
  { name: 'Playfair Display', family: "'Playfair Display', serif" },
  { name: 'Roboto', family: "'Roboto', sans-serif" },
  { name: 'Open Sans', family: "'Open Sans', sans-serif" },
  { name: 'Noto Serif', family: "'Noto Serif', serif" },
  { name: 'Source Sans Pro', family: "'Source Sans Pro', sans-serif" },
  { name: 'Arial', family: "Arial, sans-serif" },
];

interface TitlePart {
  id: number;
  text: string;
  color: string;
}

const App: React.FC = () => {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundOptions['style']>('default');
  const [color1, setColor1] = useState('#4ade80'); // Green-400
  const [color2, setColor2] = useState('#3b82f6'); // Blue-500
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);

  const [addTitle, setAddTitle] = useState(false);
  const [titleParts, setTitleParts] = useState<TitlePart[]>([
    { id: Date.now(), text: '', color: '#FFFFFF' },
  ]);
  const [titleFont, setTitleFont] = useState(fontOptions[0].family);
  const [addSubtitle, setAddSubtitle] = useState(false);
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitleColor, setSubtitleColor] = useState('#FFFFFF');

  const [addWatermark, setAddWatermark] = useState(false);
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkPreviewUrl, setWatermarkPreviewUrl] = useState<string | null>(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.2);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (backgroundPreviewUrl) URL.revokeObjectURL(backgroundPreviewUrl);
      if (watermarkPreviewUrl) URL.revokeObjectURL(watermarkPreviewUrl);
    };
  }, [previewUrl, backgroundPreviewUrl, watermarkPreviewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Vui lòng chọn một tệp hình ảnh.');
        return;
      }
      setOriginalFile(file);
      setEnhancedImageUrl(null);
      setError(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(file));
    }
     // Reset the file input so the user can select the same file again if they want
     if (event.target) {
        event.target.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleBackgroundFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            setError('Vui lòng chọn một tệp hình ảnh cho nền.');
            return;
        }
        setBackgroundImageFile(file);
        setError(null);
        if (backgroundPreviewUrl) {
            URL.revokeObjectURL(backgroundPreviewUrl);
        }
        setBackgroundPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleWatermarkFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            setError('Vui lòng chọn một tệp hình ảnh cho watermark.');
            return;
        }
        setWatermarkFile(file);
        setError(null);
        if (watermarkPreviewUrl) {
            URL.revokeObjectURL(watermarkPreviewUrl);
        }
        setWatermarkPreviewUrl(URL.createObjectURL(file));
    }
  };
  
  const handleTitlePartChange = (id: number, field: 'text' | 'color', value: string) => {
    setTitleParts(currentParts =>
      currentParts.map(part =>
        part.id === id ? { ...part, [field]: value } : part
      )
    );
  };

  const addTitlePart = () => {
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    setTitleParts(currentParts => [
      ...currentParts,
      { id: Date.now(), text: '', color: randomColor }
    ]);
  };

  const removeTitlePart = (id: number) => {
    setTitleParts(currentParts => currentParts.filter(part => part.id !== id));
  };


  const handleEnhanceClick = useCallback(async () => {
    if (!originalFile || isLoading) return;
    const validTitleParts = titleParts.filter(part => part.text.trim() !== '');
    const isTitleEmpty = validTitleParts.length === 0;
    
    if (backgroundStyle === 'upload' && !backgroundImageFile) {
        setError('Vui lòng chọn một ảnh nền.');
        return;
    }
     if (addTitle && isTitleEmpty) {
      setError('Vui lòng nhập văn bản cho ít nhất một phần tiêu đề.');
      return;
    }
    if (addTitle && addSubtitle && subtitleText.trim() === '') {
        setError('Vui lòng nhập văn bản cho dòng mô tả.');
        return;
    }
    if (addWatermark && !watermarkFile) {
        setError('Vui lòng chọn một ảnh watermark.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setEnhancedImageUrl(null);

    try {
       const backgroundOptions: BackgroundOptions = {
        style: backgroundStyle,
        color1: color1,
        color2: color2,
        backgroundImage: backgroundImageFile,
      };
      const enhancedImageBase64 = await enhanceImage(originalFile, backgroundOptions);
      let finalImageUrl = `data:image/png;base64,${enhancedImageBase64}`;
      
      if (addTitle && !isTitleEmpty) {
        const subtitleOptions: SubtitleOptions | undefined = 
          addSubtitle && subtitleText.trim() !== ''
            ? { text: subtitleText, color: subtitleColor }
            : undefined;
        finalImageUrl = await applyTitle(finalImageUrl, validTitleParts, titleFont, subtitleOptions);
      }

      if (addWatermark && watermarkFile) {
        finalImageUrl = await applyWatermark(finalImageUrl, watermarkFile, watermarkOpacity);
      }

      setEnhancedImageUrl(finalImageUrl);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi nâng cấp ảnh. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [originalFile, isLoading, backgroundStyle, color1, color2, backgroundImageFile, addTitle, titleParts, titleFont, addSubtitle, subtitleText, subtitleColor, addWatermark, watermarkFile, watermarkOpacity]);

  const handleDownload = () => {
    if (!enhancedImageUrl) return;
    const link = document.createElement('a');
    link.href = enhancedImageUrl;
    const originalName = originalFile?.name.split('.').slice(0, -1).join('.') || 'image';
    link.download = `${originalName}-enhanced.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleBackgroundStyleChange = (style: BackgroundOptions['style']) => {
      setBackgroundStyle(style);
      if (style !== 'upload') {
          setBackgroundImageFile(null);
          if (backgroundPreviewUrl) {
              URL.revokeObjectURL(backgroundPreviewUrl);
          }
          setBackgroundPreviewUrl(null);
      }
  }

  const backgroundOptionsConfig = [
    { id: 'default', label: 'Mặc Định' },
    { id: 'solid', label: 'Màu Trơn' },
    { id: 'gradient', label: 'Gradient' },
    { id: 'blur', label: 'Làm Mờ Nền Gốc' },
    { id: 'upload', label: 'Tải Lên Nền' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 md:p-8">
       <input
        ref={fileInputRef}
        id="file-upload"
        type="file"
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleFileChange}
      />
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600" style={{ fontWeight: 800 }}>
            Trình Nâng Cấp Ảnh Sản Phẩm của Vong Tình
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Tải lên ảnh sản phẩm của bạn và để AI biến nó thành một kiệt tác quảng cáo.
          </p>
        </header>

        <main className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="flex flex-col items-center gap-4">
                <ImageDisplay title="Ảnh Gốc" imageUrl={previewUrl}>
                  <div 
                    onClick={triggerFileUpload}
                    role="button"
                    aria-label="Tải lên ảnh gốc"
                    className="flex flex-col items-center justify-center w-full h-full p-4 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors">
                    <UploadIcon />
                    <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Nhấn để tải lên</span> hoặc kéo và thả</p>
                    <p className="text-xs text-gray-500">PNG, JPG, WEBP (Tối đa 5MB)</p>
                  </div>
                </ImageDisplay>
                {previewUrl && (
                    <button
                        onClick={triggerFileUpload}
                        className="flex items-center justify-center px-6 py-2.5 font-semibold text-white bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 transform transition-transform duration-300 hover:scale-105"
                        aria-label="Tải lên một ảnh gốc khác trong khi giữ nguyên các cài đặt"
                    >
                        <UploadIcon className="w-6 h-6 mr-2" />
                        Thử với ảnh khác
                    </button>
                )}
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <ImageDisplay title="Ảnh Đã Nâng Cấp" imageUrl={enhancedImageUrl} isLoading={isLoading}>
                  <div className="text-center text-gray-500">
                      <p>Hình ảnh được nâng cấp sẽ xuất hiện ở đây.</p>
                  </div>
              </ImageDisplay>
              {enhancedImageUrl && !isLoading && (
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center px-6 py-3 font-semibold text-white bg-teal-600 rounded-lg shadow-md hover:bg-teal-700 transform transition-transform duration-300 hover:scale-105"
                  aria-label="Tải xuống ảnh đã nâng cấp"
                >
                  <DownloadIcon />
                  Tải Xuống Ảnh
                </button>
              )}
            </div>
          </div>
          
          {originalFile && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 my-4 w-full max-w-4xl mx-auto">
              <h3 className="text-xl font-bold mb-6 text-center text-gray-200">Chọn Phong Cách Nền</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
                {backgroundOptionsConfig.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => handleBackgroundStyleChange(id as BackgroundOptions['style'])}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                      backgroundStyle === id ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex justify-center items-center gap-6 transition-opacity duration-300" style={{ opacity: backgroundStyle === 'solid' || backgroundStyle === 'gradient' ? 1 : 0, maxHeight: backgroundStyle === 'solid' || backgroundStyle === 'gradient' ? '100px' : '0', overflow: 'hidden' }}>
                  { (backgroundStyle === 'solid' || backgroundStyle === 'gradient') && (
                      <div className="flex items-center gap-2">
                          <label htmlFor="color1" className="text-sm font-medium">Màu 1:</label>
                          <input type="color" id="color1" value={color1} onChange={(e) => setColor1(e.target.value)} className="w-10 h-10 p-1 bg-gray-800 border border-gray-600 rounded-lg cursor-pointer" />
                      </div>
                  )}
                  { backgroundStyle === 'gradient' && (
                      <div className="flex items-center gap-2">
                          <label htmlFor="color2" className="text-sm font-medium">Màu 2:</label>
                          <input type="color" id="color2" value={color2} onChange={(e) => setColor2(e.target.value)} className="w-10 h-10 p-1 bg-gray-800 border border-gray-600 rounded-lg cursor-pointer" />
                      </div>
                  )}
              </div>
               {backgroundStyle === 'upload' && (
                    <div className="mt-4 flex flex-col items-center transition-all duration-300">
                        <label htmlFor="background-upload" className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        Chọn Ảnh Nền
                        </label>
                        <input id="background-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleBackgroundFileChange} />
                        {backgroundPreviewUrl && (
                        <div className="mt-4">
                            <p className="text-sm text-gray-400 mb-2">Xem trước nền:</p>
                            <img src={backgroundPreviewUrl} alt="Background Preview" className="w-32 h-32 object-cover rounded-lg border-2 border-gray-600" />
                        </div>
                        )}
                    </div>
                )}
            </div>
          )}

          {originalFile && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 my-4 w-full max-w-4xl mx-auto">
                <h3 className="text-xl font-bold mb-4 text-center text-gray-200">Thêm Tiêu Đề (Tùy chọn)</h3>
                 <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center">
                        <input
                            id="add-title-checkbox"
                            type="checkbox"
                            checked={addTitle}
                            onChange={(e) => setAddTitle(e.target.checked)}
                            className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                        />
                        <label htmlFor="add-title-checkbox" className="ml-3 text-md font-medium text-gray-300">
                            Bật Tiêu Đề
                        </label>
                    </div>

                    {addTitle && (
                         <div className="mt-2 w-full max-w-xl flex flex-col items-center gap-4">
                            <div className="w-full">
                                <label htmlFor="font-select" className="block mb-2 text-sm font-medium text-gray-300">Chọn Font Chữ:</label>
                                <select
                                    id="font-select"
                                    value={titleFont}
                                    onChange={(e) => setTitleFont(e.target.value)}
                                    className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5"
                                >
                                    {fontOptions.map(font => (
                                        <option key={font.name} value={font.family} style={{ fontFamily: font.family }}>
                                            {font.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full space-y-3">
                              {titleParts.map((part, index) => (
                                <div key={part.id} className="w-full flex items-center gap-2 animate-fade-in">
                                  <input
                                      type="text"
                                      value={part.text}
                                      onChange={(e) => handleTitlePartChange(part.id, 'text', e.target.value)}
                                      placeholder={`Phần ${index + 1}`}
                                      className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 p-2.5"
                                      aria-label={`Văn bản cho phần ${index + 1}`}
                                  />
                                  <input
                                      type="color"
                                      value={part.color}
                                      onChange={(e) => handleTitlePartChange(part.id, 'color', e.target.value)}
                                      className="w-10 h-10 p-1 bg-gray-800 border border-gray-600 rounded-lg cursor-pointer flex-shrink-0"
                                      aria-label={`Chọn màu cho phần ${index + 1}`}
                                  />
                                  <button
                                      onClick={() => removeTitlePart(part.id)}
                                      disabled={titleParts.length <= 1}
                                      className="flex-shrink-0 p-2.5 bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                      aria-label={`Xóa phần ${index + 1}`}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>

                            <button
                                onClick={addTitlePart}
                                className="mt-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                + Thêm Phần Văn Bản
                            </button>
                            
                            <hr className="w-full border-gray-600 my-4" />

                            <div className="w-full">
                                <div className="flex items-center mb-4">
                                    <input
                                        id="add-subtitle-checkbox"
                                        type="checkbox"
                                        checked={addSubtitle}
                                        onChange={(e) => setAddSubtitle(e.target.checked)}
                                        className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                                    />
                                    <label htmlFor="add-subtitle-checkbox" className="ml-3 text-md font-medium text-gray-300">
                                        Thêm Dòng Mô Tả
                                    </label>
                                </div>
                                {addSubtitle && (
                                    <div className="w-full flex items-center gap-2 animate-fade-in">
                                        <input
                                            type="text"
                                            value={subtitleText}
                                            onChange={(e) => setSubtitleText(e.target.value)}
                                            placeholder="Mô tả ngắn về sản phẩm"
                                            className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 p-2.5"
                                            aria-label="Văn bản cho dòng mô tả"
                                        />
                                        <input
                                            type="color"
                                            value={subtitleColor}
                                            onChange={(e) => setSubtitleColor(e.target.value)}
                                            className="w-10 h-10 p-1 bg-gray-800 border border-gray-600 rounded-lg cursor-pointer flex-shrink-0"
                                            aria-label="Chọn màu cho dòng mô tả"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
          )}

          {originalFile && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 my-4 w-full max-w-4xl mx-auto">
                <h3 className="text-xl font-bold mb-4 text-center text-gray-200">Thêm Watermark (Tùy chọn)</h3>
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center">
                        <input
                            id="add-watermark-checkbox"
                            type="checkbox"
                            checked={addWatermark}
                            onChange={(e) => setAddWatermark(e.target.checked)}
                            className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                        />
                        <label htmlFor="add-watermark-checkbox" className="ml-3 text-md font-medium text-gray-300">
                            Bật Watermark
                        </label>
                    </div>

                    {addWatermark && (
                        <div className="mt-2 flex flex-col items-center transition-all duration-300 w-full max-w-md">
                            <label htmlFor="watermark-upload" className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                Chọn Ảnh Watermark
                            </label>
                            <input id="watermark-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleWatermarkFileChange} />
                            {watermarkPreviewUrl && (
                                <div className="mt-4">
                                    <p className="text-sm text-gray-400 mb-2">Xem trước watermark:</p>
                                    <img src={watermarkPreviewUrl} alt="Watermark Preview" className="w-24 h-24 object-contain rounded-lg border-2 border-gray-600 bg-gray-900/50 p-1" />
                                </div>
                            )}
                             <div className="mt-4 w-full">
                                <label htmlFor="watermark-opacity" className="block mb-2 text-sm font-medium text-gray-300">
                                    Độ trong suốt: {Math.round(watermarkOpacity * 100)}%
                                </label>
                                <input
                                    id="watermark-opacity"
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={watermarkOpacity}
                                    onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                    aria-label="Điều chỉnh độ trong suốt của watermark"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-center" role="alert">
              <strong className="font-bold">Lỗi: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div className="flex justify-center mt-4">
            <button
              onClick={handleEnhanceClick}
              disabled={!originalFile || isLoading || (backgroundStyle === 'upload' && !backgroundImageFile) || (addTitle && titleParts.every(p => p.text.trim() === '')) || (addWatermark && !watermarkFile) || (addTitle && addSubtitle && subtitleText.trim() === '')}
              className="px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow-lg hover:scale-105 transform transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? 'Đang Xử Lý...' : 'Nâng Cấp Ảnh'}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;