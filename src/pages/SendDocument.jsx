
import { useEffect, useState } from 'react';

import {
  FileText,
  Upload,
  User,
  Mail,
  MessageSquare,
  Send,
  ArrowLeft,
  ShieldCheck,
  X,
  Eye,
  FileCheck
} from 'lucide-react';

import PdfFieldEditor from '../components/PdfFieldEditor';

export default function SendDocument({ onBack }) {
  const [file, setFile] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fields, setFields] = useState([]);

  // Create and clean up the PDF preview URL.
  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Select one PDF document.
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];

    // Allow selecting the same file again later.
    e.target.value = '';

    if (!selected) return;

    if (
      selected.type !== 'application/pdf' &&
      !selected.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Only PDF documents are allowed.');
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10 MB.');
      return;
    }

    setError('');
    setFields([]);
    setFile(selected);

    setDocumentTitle(
      selected.name.replace(/\.pdf$/i, '')
    );
  };

  // Remove the currently selected PDF.
  const handleRemoveDocument = () => {
    const confirmed = window.confirm(
      'Are you sure you want to remove this document? All signature and date placements will also be cleared.'
    );

    if (!confirmed) return;

    setFile(null);
    setPreviewUrl('');
    setDocumentTitle('');
    setFields([]);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please upload a PDF document.');
      return;
    }

    if (!documentTitle.trim() || !clientName.trim() || !email.trim()) {
      setError('Please complete all required fields.');
      return;
    }

    // Frontend validation only.
    // Actual upload and email delivery require backend integration.
    setSuccess(true);
  };

  // Reset the form so another document can be selected.
  const resetForm = () => {
    setFile(null);
    setDocumentTitle('');
    setClientName('');
    setEmail('');
    setMessage('');
    setError('');
    setSuccess(false);
    setFields([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">

        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
              <Send size={25} />
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              Send Document
            </h1>
          </div>

          <p className="text-slate-500">
            Upload a document and invite a client to sign it securely.
          </p>
        </div>

        {success ? (
          <div className="bg-white border border-green-200 rounded-2xl p-10 text-center">
            <ShieldCheck
              size={55}
              className="text-green-600 mx-auto mb-5"
            />

            <h2 className="text-2xl font-bold text-slate-900">
              Form Completed!
            </h2>

            <p className="text-slate-500 mt-3">
              Your document details passed frontend validation.
              The document has not yet been uploaded or emailed.
              Backend integration is required for actual delivery.
            </p>

            <button
              onClick={resetForm}
              className="mt-7 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl"
            >
              Add Another Document
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* DOCUMENT INFORMATION */}
            <div className="bg-white border border-slate-200 rounded-2xl p-7">
              <h2 className="font-bold text-lg mb-2">
                Document Information
              </h2>

              <p className="text-sm text-slate-500 mb-6">
                Select one PDF document and provide its title.
              </p>

              <label className="block text-sm font-semibold mb-2">
                Document Title
              </label>

              <input
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                required
                maxLength={100}
                placeholder="e.g. Employment Agreement"
                className="w-full border border-slate-200 rounded-xl p-3 mb-6 outline-none focus:border-blue-500"
              />

              {/* SHOW UPLOAD AREA ONLY WHEN NO PDF IS SELECTED */}
              {!file ? (
                <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition">
                  <Upload size={35} className="text-blue-600 mb-3" />

                  <span className="font-semibold text-slate-700">
                    Click to upload PDF
                  </span>

                  <span className="text-sm text-slate-400 mt-2">
                    PDF only · Maximum size 10 MB
                  </span>

                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              ) : (
                /* SHOW SELECTED DOCUMENT INSTEAD OF UPLOAD AREA */
                <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-white p-3 rounded-xl border border-blue-100">
                        <FileCheck
                          size={28}
                          className="text-blue-600"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          Document Selected
                        </p>

                        <p className="text-sm text-slate-600 truncate">
                          {file.name}
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-2 rounded-lg">
                        Ready
                      </span>

                      <button
                        type="button"
                        onClick={handleRemoveDocument}
                        className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        <X size={17} />
                        Remove
                      </button>
                    </div>

                  </div>

                  <p className="text-xs text-slate-500 mt-4">
                    One document can be active at a time. Remove this
                    document if you want to select another PDF.
                  </p>
                </div>
              )}

              {/* PDF FIELD EDITOR */}
              {file && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 mt-6">
                  <div className="mb-5">
                    <h2 className="font-bold text-lg">
                      Place Signature and Date Fields
                    </h2>

                    <p className="text-sm text-slate-500 mt-2">
                      Add fields to your PDF, then drag or resize them
                      to position them correctly.
                    </p>
                  </div>

                  <PdfFieldEditor
                    file={file}
                    fields={fields}
                    onFieldsChange={setFields}
                    editable={true}
                  />
                </div>
              )}
            </div>

            {/* PDF PREVIEW */}
            {previewUrl && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="text-blue-600" size={20} />

                  <h2 className="font-bold text-lg">
                    PDF Preview
                  </h2>
                </div>

                <iframe
                  src={previewUrl}
                  title="PDF document preview"
                  className="w-full h-[550px] rounded-xl border border-slate-200"
                />

                <p className="text-xs text-slate-500 mt-3">
                  Preview of the PDF selected on this device.
                </p>
              </div>
            )}

            {/* CLIENT INFORMATION */}
            <div className="bg-white border border-slate-200 rounded-2xl p-7">
              <h2 className="font-bold text-lg mb-2">
                Client Information
              </h2>

              <p className="text-sm text-slate-500 mb-6">
                Enter the details of the person who will sign.
              </p>

              <div className="space-y-5">

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Client Full Name
                  </label>

                  <div className="relative">
                    <User
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />

                    <input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      required
                      placeholder="Enter client's full name"
                      className="w-full border border-slate-200 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Email Address
                  </label>

                  <div className="relative">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="client@example.com"
                      className="w-full border border-slate-200 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Personal Message (Optional)
                  </label>

                  <div className="relative">
                    <MessageSquare
                      className="absolute left-4 top-4 text-slate-400"
                      size={19}
                    />

                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Please review and sign this document."
                      rows={4}
                      className="w-full border border-slate-200 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">
                {error}
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-semibold flex items-center gap-2"
              >
                <Send size={18} />
                Continue
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
