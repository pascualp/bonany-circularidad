import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Download, CheckCircle2, AlertCircle, Loader2, FileArchive, Image as ImageIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseExcelFile } from './services/excelService';
import { generateHotelPDF } from './services/pdfService';
import { HotelReport } from './types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function App() {
  const [reports, setReports] = useState<HotelReport[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    const savedLogo = localStorage.getItem('bonany_custom_logo');
    if (savedLogo) {
      setCustomLogo(savedLogo);
    }
  }, []);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setCustomLogo(base64String);
      localStorage.setItem('bonany_custom_logo', base64String);
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setCustomLogo(null);
    localStorage.removeItem('bonany_custom_logo');
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      const parsedReports = await parseExcelFile(file);
      if (parsedReports.length === 0) {
        throw new Error('No se encontraron datos válidos. Asegúrate de que el Excel tenga columnas llamadas "Mes", "Total", "Producto Local", etc., y que no haya filas vacías al inicio.');
      }
      setReports(parsedReports);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const downloadIndividualPDF = async (report: HotelReport) => {
    try {
      const blob = await generateHotelPDF(report);
      saveAs(blob, `Informe_Circularidad_2025_${report.hotelName} Final.pdf`);
    } catch (err) {
      setError('Error al generar el PDF.');
    }
  };

  const downloadAllAsZip = async () => {
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      for (const report of reports) {
        const blob = await generateHotelPDF(report);
        zip.file(`Informe_Circularidad_2025_${report.hotelName} Final.pdf`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'Informes_Circularidad_2025_por_hoja Final.zip');
    } catch (err) {
      setError('Error al generar el archivo ZIP.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {customLogo ? (
              <img src={customLogo} alt="Logo" className="h-8 object-contain" />
            ) : (
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
            )}
            <h1 className="text-xl font-semibold tracking-tight">Circularidad</h1>
          </div>
          <div className="text-sm text-slate-500 font-medium">Generador de Informes 2025</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Transforma tus datos en informes</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Sube tu archivo Excel con los datos de circularidad y generaremos automáticamente un PDF profesional para cada hotel.
          </p>
        </motion.div>

        {/* Settings Section */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Logo del Informe</h3>
              <p className="text-sm text-slate-500">Sube tu logo exacto para que aparezca en los PDFs.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {customLogo && (
              <button 
                onClick={clearLogo}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar logo"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <div className="relative">
              <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={handleLogoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                <Upload className="w-4 h-4" />
                {customLogo ? 'Cambiar Logo' : 'Subir Logo'}
              </button>
            </div>
          </div>
        </section>

        {/* Upload Section */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8">
          <div className="relative group">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={isProcessing}
            />
            <div className={`
              border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all
              ${isProcessing ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50/30 border-emerald-200 group-hover:bg-emerald-50 group-hover:border-emerald-300'}
            `}>
              {isProcessing ? (
                <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
              ) : (
                <Upload className="w-12 h-12 text-emerald-600 mb-4 transition-transform group-hover:-translate-y-1" />
              )}
              <p className="text-lg font-medium text-slate-900 mb-1">
                {isProcessing ? 'Procesando archivo...' : 'Haz clic o arrastra tu Excel aquí'}
              </p>
              <p className="text-sm text-slate-500">Soporta archivos .xlsx y .xls con múltiples hojas</p>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700"
              >
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">¡Archivo procesado con éxito! Se han detectado {reports.length} hoteles.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Results Section */}
        <AnimatePresence>
          {reports.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Informes Generados</h3>
                <button
                  onClick={downloadAllAsZip}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                  Descargar todo (.ZIP)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports.map((report, idx) => (
                  <motion.div
                    key={report.hotelName}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{report.hotelName}</h4>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Informe Circularidad 2025</p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadIndividualPDF(report)}
                      className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all"
                      title="Descargar PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-200 mt-12 text-center">
        <p className="text-sm text-slate-400">© 2025 Circularidad. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
