import React, { useState, useCallback, useEffect, useRef } from 'react';
import { enhanceImage, BackgroundOptions } from './services/geminiService';
import { applyWatermark, applyTitle, SubtitleOptions, WatermarkPosition } from './utils/fileUtils';

const UploadIcon: React.FC<{className?: string}> = ({className = "w-12 h-12 mb-4 text-gray-500"}) => (
  <svg className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
  </svg>
);

const DownloadIcon: React.FC = () => (
    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
);

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

interface UsageStats {
  today: number;
  yesterday: number;
  last7Days: number;
  thisMonth: number;
  total: number;
}

const getISODateString = (date: Date): string => {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
    return adjustedDate.toISOString().split('T')[0];
};

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null);
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  
  const [backgroundOptions, setBackgroundOptions] = useState<BackgroundOptions>({
    style: 'default',
    color1: '#4ade80',
    color2: '#3b82f6'
  });
  
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');

  const [titlePart1, setTitlePart1] = useState('');
  const [titleColor1, setTitleColor1] = useState('#FFFFFF');
  const [titlePart2, setTitlePart2] = useState('');
  const [titleColor2, setTitleColor2] = useState('#FFD700');
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitleColor, setSubtitleColor] = useState('#FFFFFF');
  const [fontFamily, setFontFamily] = useState('Oswald');

  const [watermarkOpacity, setWatermarkOpacity] = useState(0.5);
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottomRight');
  const [watermarkSize, setWatermarkSize] = useState(0.15);
  
  const finalImageRef = useRef<HTMLImageElement>(null);

  const [usageStats, setUsageStats] = useState<UsageStats>({ today: 0, yesterday: 0, last7Days: 0, thisMonth: 0, total: 0 });

  const calculateStats = useCallback((data: any): UsageStats => {
    const dailyCounts = data?.dailyCounts || {};
    const total = data?.total || 0;

    const now = new Date();
    const todayStr = getISODateString(now);

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = getISODateString(yesterday);

    let last7DaysCount = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        last7DaysCount += dailyCounts[getISODateString(d)] || 0;
    }

    let thisMonthCount = 0;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    for (const dateStr in dailyCounts) {
        const [year, month] = dateStr.split('-').map(Number);
        if (year === currentYear && (month - 1) === currentMonth) {
            thisMonthCount += dailyCounts[dateStr];
        }
    }

    return {
        today: dailyCounts[todayStr] || 0,
        yesterday: dailyCounts[yesterdayStr] || 0,
        last7Days: last7DaysCount,
        thisMonth: thisMonthCount,
        total: total,
    };
  }, []);

  useEffect(() => {
    const storedStatsRaw = localStorage.getItem('vongtinhImageEnhancerStats');
    let storedStats: any = {};
    if (storedStatsRaw) {
        try {
            storedStats = JSON.parse(storedStatsRaw);
            // Migration logic for old structure
            if (storedStats.hasOwnProperty('today') && storedStats.hasOwnProperty('total') && !storedStats.hasOwnProperty('dailyCounts')) {
                const todayDate = storedStats.today.date;
                const todayCount = storedStats.today.count;
                const todayDateObj = new Date().toISOString().split('T')[0];

                const newDailyCounts = {};
                if (todayDate === todayDateObj) {
                  newDailyCounts[todayDate] = todayCount;
                }

                storedStats = {
                    total: storedStats.total,
                    dailyCounts: newDailyCounts
                }
                localStorage.setItem('vongtinhImageEnhancerStats', JSON.stringify(storedStats));
            }

        } catch (e) {
            console.error("Failed to parse usage stats.", e);
            localStorage.removeItem('vongtinhImageEnhancerStats');
        }
    }
    setUsageStats(calculateStats(storedStats));
  }, [calculateStats]);
  
  const incrementUsage = useCallback(() => {
      const storedStatsRaw = localStorage.getItem('vongtinhImageEnhancerStats');
      let currentStats: { total: number; dailyCounts: { [key: string]: number } } = { total: 0, dailyCounts: {} };
       if (storedStatsRaw) {
          try {
              currentStats = JSON.parse(storedStatsRaw);
              if (!currentStats.dailyCounts) currentStats.dailyCounts = {};
          } catch (e) {
               console.error("Failed to parse stats on increment, starting fresh.", e);
          }
      }
  
      const todayStr = getISODateString(new Date());
  
      const newTotal = (currentStats.total || 0) + 1;
      const newDailyCounts = {
          ...currentStats.dailyCounts,
          [todayStr]: ((currentStats.dailyCounts[todayStr] || 0) + 1)
      };
      
      const newStatsToStore = {
        total: newTotal,
        dailyCounts: newDailyCounts
      };
  
      localStorage.setItem('vongtinhImageEnhancerStats', JSON.stringify(newStatsToStore));
      setUsageStats(calculateStats(newStatsToStore));
  }, [calculateStats]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setEnhancedImage(null);
      setFinalImage(null);
      setError(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if(e.dataTransfer.files[0].type.startsWith('image/')) {
        setImageFile(e.dataTransfer.files[0]);
        setEnhancedImage(null);
        setFinalImage(null);
        setError(null);
      } else {
        setError("Vui lòng chỉ tải lên tệp hình ảnh.");
      }
    }
  }, []);

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragOver(true);
    } else if (e.type === 'dragleave') {
      setDragOver(false);
    }
  };

  const processImageFinalization = useCallback(async () => {
    if (!enhancedImage) return;
    setLoadingMessage("Áp dụng tiêu đề và watermark...");
    let imageToProcess = enhancedImage;

    const titleParts = [
        { text: titlePart1, color: titleColor1 },
        { text: titlePart2, color: titleColor2 },
    ];
    const subtitleOptions: SubtitleOptions = { text: subtitleText, color: subtitleColor };

    // Always process image to apply correct aspect ratio, even if there's no title
    imageToProcess = await applyTitle(imageToProcess, titleParts, fontFamily, subtitleOptions, aspectRatio);
    
    if (watermarkFile) {
      imageToProcess = await applyWatermark(imageToProcess, watermarkFile, watermarkOpacity, watermarkPosition, watermarkSize);
    }
    
    setFinalImage(imageToProcess);
  }, [enhancedImage, titlePart1, titleColor1, titlePart2, titleColor2, subtitleText, subtitleColor, fontFamily, watermarkFile, watermarkOpacity, watermarkPosition, watermarkSize, aspectRatio]);

  useEffect(() => {
    if (enhancedImage) {
      processImageFinalization();
    }
  }, [enhancedImage, processImageFinalization]);


  const handleEnhance = async () => {
    if (!imageFile) {
      setError("Vui lòng chọn một hình ảnh để nâng cấp.");
      return;
    }
    if (backgroundOptions.style === 'upload' && !backgroundImageFile) {
        setError("Vui lòng tải lên ảnh nền khi chọn tùy chọn 'Nền tùy chỉnh'.");
        return;
    }
    setLoading(true);
    setError(null);
    setEnhancedImage(null);
    setFinalImage(null);
    setLoadingMessage("AI đang xử lý hình ảnh của bạn...");

    try {
      const optionsWithImage = { ...backgroundOptions, backgroundImage: backgroundImageFile };
      const base64Image = await enhanceImage(imageFile, optionsWithImage, aspectRatio);
      setEnhancedImage(`data:image/png;base64,${base64Image}`);
      incrementUsage(); // Increment usage on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.");
      setEnhancedImage(null);
      setFinalImage(null);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };
  
  const downloadImage = () => {
    if (!finalImage) return;
    const link = document.createElement('a');
    link.href = finalImage;
    link.download = `enhanced-${imageFile?.name || 'image'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const fontOptions = ['Oswald', 'Roboto', 'Montserrat', 'Playfair Display', 'Noto Serif', 'Open Sans', 'Source Sans Pro', 'Pacifico', 'Be Vietnam Pro'];

  const ControlPanel: React.FC = () => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3 text-green-300">1. Tùy Chọn Nền</h3>
        <select value={backgroundOptions.style} onChange={(e) => setBackgroundOptions(prev => ({...prev, style: e.target.value as BackgroundOptions['style']}))} className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="default">Gradient Xanh Ngọc (Mặc định)</option>
          <option value="solid">Màu trơn</option>
          <option value="gradient">Gradient tùy chỉnh</option>
          <option value="blur">Làm mờ nền gốc</option>
          <option value="upload">Nền tùy chỉnh</option>
        </select>
        {(backgroundOptions.style === 'solid' || backgroundOptions.style === 'gradient') && (
          <div className="flex items-center space-x-4 mt-3">
            <input type="color" value={backgroundOptions.color1} onChange={(e) => setBackgroundOptions(prev => ({...prev, color1: e.target.value}))} className="w-10 h-10 bg-gray-700 rounded cursor-pointer" />
            {backgroundOptions.style === 'gradient' &&
              <input type="color" value={backgroundOptions.color2} onChange={(e) => setBackgroundOptions(prev => ({...prev, color2: e.target.value}))} className="w-10 h-10 bg-gray-700 rounded cursor-pointer" />
            }
          </div>
        )}
        {backgroundOptions.style === 'upload' && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-300 mb-1">Tải lên ảnh nền</label>
            <input type="file" accept="image/*" onChange={e => setBackgroundImageFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"/>
          </div>
        )}
      </div>

      <div>
          <h3 className="text-lg font-semibold mb-3 text-cyan-300">2. Tỷ lệ ảnh</h3>
          <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="1:1">Vuông (1:1)</option>
              <option value="4:3">Tiêu chuẩn (4:3)</option>
              <option value="3:4">Dọc (3:4)</option>
              <option value="16:9">Rộng (16:9)</option>
              <option value="9:16">Story (9:16)</option>
          </select>
      </div>

       <div>
        <h3 className="text-lg font-semibold mb-3 text-blue-300">3. Tùy Chỉnh Tiêu Đề</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Phần 1 Tiêu đề" value={titlePart1} onChange={e => setTitlePart1(e.target.value)} className="w-full p-2 bg-gray-700 rounded border border-gray-600"/>
            <input type="color" value={titleColor1} onChange={e => setTitleColor1(e.target.value)} className="w-full h-10 bg-gray-700 rounded cursor-pointer"/>
            <input type="text" placeholder="Phần 2 Tiêu đề" value={titlePart2} onChange={e => setTitlePart2(e.target.value)} className="w-full p-2 bg-gray-700 rounded border border-gray-600"/>
            <input type="color" value={titleColor2} onChange={e => setTitleColor2(e.target.value)} className="w-full h-10 bg-gray-700 rounded cursor-pointer"/>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <input type="text" placeholder="Phụ đề" value={subtitleText} onChange={e => setSubtitleText(e.target.value)} className="w-full p-2 bg-gray-700 rounded border border-gray-600"/>
            <input type="color" value={subtitleColor} onChange={e => setSubtitleColor(e.target.value)} className="w-full h-10 bg-gray-700 rounded cursor-pointer"/>
        </div>
        <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">Font chữ</label>
            <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full p-2 bg-gray-700 rounded border border-gray-600">
                {fontOptions.map(font => <option key={font} value={font}>{font}</option>)}
            </select>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 text-purple-300">4. Tùy Chỉnh Watermark</h3>
        <input type="file" accept="image/png, image/svg+xml" onChange={e => setWatermarkFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"/>
        {watermarkFile && (
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">Độ mờ: {Math.round(watermarkOpacity * 100)}%</label>
              <input type="range" min="0" max="1" step="0.05" value={watermarkOpacity} onChange={e => setWatermarkOpacity(parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-300">Kích thước: {Math.round(watermarkSize * 100)}%</label>
              <input type="range" min="0.05" max="0.5" step="0.01" value={watermarkSize} onChange={e => setWatermarkSize(parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Vị trí</label>
              <select value={watermarkPosition} onChange={e => setWatermarkPosition(e.target.value as WatermarkPosition)} className="w-full p-2 bg-gray-700 rounded border border-gray-600">
                <option value="bottomRight">Dưới Cùng Bên Phải</option>
                <option value="bottomLeft">Dưới Cùng Bên Trái</option>
                <option value="topRight">Trên Cùng Bên Phải</option>
                <option value="topLeft">Trên Cùng Bên Trái</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
              Trình Nâng Cấp Ảnh Sản Phẩm
            </span>
            <span className="text-gray-400"> của Vong Tình</span>
          </h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Một ứng dụng web để nâng cấp hình ảnh sản phẩm bằng AI, cải thiện ánh sáng, nền và chất lượng tổng thể để tạo ra hình ảnh quảng cáo cao cấp.
          </p>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-gray-300 animate-fade-in">
            <div className="text-center bg-gray-800/50 px-4 py-2 rounded-lg">
              <p className="text-2xl font-bold text-green-400">{usageStats.today}</p>
              <p className="text-sm">Hôm nay</p>
            </div>
            <div className="text-center bg-gray-800/50 px-4 py-2 rounded-lg">
              <p className="text-2xl font-bold text-blue-400">{usageStats.yesterday}</p>
              <p className="text-sm">Hôm qua</p>
            </div>
            <div className="text-center bg-gray-800/50 px-4 py-2 rounded-lg">
              <p className="text-2xl font-bold text-purple-400">{usageStats.last7Days}</p>
              <p className="text-sm">7 ngày qua</p>
            </div>
            <div className="text-center bg-gray-800/50 px-4 py-2 rounded-lg">
              <p className="text-2xl font-bold text-orange-400">{usageStats.thisMonth}</p>
              <p className="text-sm">Tháng này</p>
            </div>
            <div className="text-center bg-gray-800/50 px-4 py-2 rounded-lg col-span-2 md:col-span-1 lg:col-span-1">
              <p className="text-2xl font-bold text-cyan-400">{usageStats.total}</p>
              <p className="text-sm">Tổng cộng</p>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
             <div 
              onDrop={handleDrop} 
              onDragOver={handleDragEvents} 
              onDragEnter={handleDragEvents} 
              onDragLeave={handleDragEvents}
              className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-800 border-gray-600 hover:border-green-500 hover:bg-gray-700 transition-colors ${dragOver ? 'border-green-500 bg-gray-700' : ''}`}
            >
              <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-full">
                  <UploadIcon />
                  <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Nhấn để tải lên</span> hoặc kéo và thả</p>
                  <p className="text-xs text-gray-500">PNG, JPG, WEBP (Tối đa 5MB)</p>
                  {imageFile && <p className="mt-2 text-sm text-green-400 truncate max-w-full px-4">{imageFile.name}</p>}
              </label>
              <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
            
            <ControlPanel />

            <button
              onClick={handleEnhance}
              disabled={loading || !imageFile}
              className="w-full flex items-center justify-center bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg text-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105"
            >
              {loading ? <><LoadingSpinner /> {loadingMessage}</> : '✨ Nâng Cấp Hình Ảnh'}
            </button>
            {error && <div className="bg-red-800/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg animate-fade-in" role="alert">{error}</div>}
          </div>

          <div className="lg:col-span-2 bg-gray-800 p-4 rounded-lg shadow-xl flex items-center justify-center min-h-[50vh]">
            {finalImage ? (
                <div className="animate-fade-in w-full">
                    <img ref={finalImageRef} src={finalImage} alt="Enhanced Product" className="max-w-full max-h-[70vh] mx-auto rounded-lg shadow-2xl" />
                    <button onClick={downloadImage} className="mt-4 w-full flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                        <DownloadIcon />
                        Tải Xuống Hình Ảnh
                    </button>
                </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>Hình ảnh đã nâng cấp sẽ xuất hiện ở đây</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;