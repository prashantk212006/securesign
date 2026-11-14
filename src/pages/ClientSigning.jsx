
import { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import {
  FileSignature,
  ShieldCheck,
  Type,
  PenLine,
  Trash2,
  CheckCircle,
  AlertCircle,
  FileText,
  Loader2
} from 'lucide-react';

import PdfFieldEditor from '../components/PdfFieldEditor';

export default function ClientSigning() {
  const { token } = useParams();

  const API_URL =
    import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const signatureRef = useRef(null);

  const [documentUrl, setDocumentUrl] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [fields, setFields] = useState([]);

  const [mode, setMode] = useState('draw');
  const [signerName, setSignerName] = useState('');
  const [consent, setConsent] = useState(false);

  // Live signature and date preview
  const [signatureImage, setSignatureImage] = useState('');
  const [signedDate] = useState(
    new Date().toLocaleDateString('en-IN')
  );
  const [error, setError] = useState('');
  const [loadingDocument, setLoadingDocument] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Load invitation, assigned fields, and PDF.
  useEffect(() => {
    let active = true;
    let objectUrl = null;

    async function loadInvitation() {
      try {
        setLoadingDocument(true);
        setError('');

        const invitationResponse = await fetch(
          `${API_URL}/api/signatures/invitation/${encodeURIComponent(token)}`
        );

        const invitationData = await invitationResponse.json();

        if (!invitationResponse.ok) {
          throw new Error(
            invitationData.detail ||
            'This signing invitation is invalid or expired.'
          );
        }

        if (!active) return;

        setDocumentName(
          invitationData.title || 'Signing Document'
        );

        // Load fields allocated by the administrator.
        let assignedFields = invitationData.fields || [];

        // Support a JSON string as well as an array.
        if (typeof assignedFields === 'string') {
          try {
            assignedFields = JSON.parse(assignedFields);
          } catch {
            assignedFields = [];
          }
        }

        setFields(
          Array.isArray(assignedFields) ? assignedFields : []
        );

        // Fetch the PDF using the public invitation token.
        const pdfResponse = await fetch(
          `${API_URL}/api/signatures/invitation/${encodeURIComponent(token)}/document`
        );

        if (!pdfResponse.ok) {
          const pdfError = await pdfResponse.json().catch(() => ({}));

          throw new Error(
            pdfError.detail || 'Unable to load the document PDF.'
          );
        }

        const pdfBlob = await pdfResponse.blob();

        if (!active) return;

        objectUrl = URL.createObjectURL(pdfBlob);
        setDocumentUrl(objectUrl);

      } catch (err) {
        if (active) {
          setError(
            err.message || 'Unable to load the signing invitation.'
          );
        }
      } finally {
        if (active) {
          setLoadingDocument(false);
        }
      }
    }

    if (token) {
      loadInvitation();
    } else {
      setError('Signing invitation token is missing.');
      setLoadingDocument(false);
    }

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [API_URL, token]);

  // Clear drawn signature.
  const clearSignature = () => {
    signatureRef.current?.clear();
    setSignatureImage('');
    setError('');
  };

  // Convert typed name into a PNG image.
  const createTypedSignature = (name) => {
    const canvas = document.createElement('canvas');

    canvas.width = 700;
    canvas.height = 180;

    const context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#172554';
    context.font = 'italic 48px cursive';
    context.textBaseline = 'middle';

    context.fillText(name, 20, 90, 660);

    return canvas.toDataURL('image/png');
  };

  // Submit signature.
  const handleSubmit = async () => {
    setError('');

    if (loadingDocument || !documentUrl) {
      setError('The document has not loaded yet. Please wait.');
      return;
    }

    if (!signerName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    let signature;

    if (mode === 'draw') {
      if (!signatureRef.current || signatureRef.current.isEmpty()) {
        setError('Please draw your signature first.');
        return;
      }

      signature = signatureRef.current.toDataURL('image/png');
    } else {
      signature = createTypedSignature(signerName.trim());
    }

    if (!consent) {
      setError(
        'Please accept the signing consent before continuing.'
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_URL}/api/signatures/invitation/${encodeURIComponent(token)}/sign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            signer_name: signerName.trim(),
            signature_text: signature
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || 'Unable to submit your signature.'
        );
      }

      setCompleted(true);

    } catch (err) {
      setError(
        err.message ||
        'Unable to submit your signature. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen.
  if (completed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-10 max-w-md w-full text-center">

          <CheckCircle
            size={60}
            className="text-green-600 mx-auto mb-5"
          />

          <h1 className="text-2xl font-bold text-slate-900">
            Document Signed Successfully
          </h1>

          <p className="text-slate-500 mt-3">
            Your signature has been submitted successfully.
          </p>

          <p className="text-sm text-slate-400 mt-5">
            You may now close this page.
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">

          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl">
              <FileSignature size={24} />
            </div>

            <span className="text-xl font-bold text-slate-900">
              SecureSign
            </span>
          </div>

          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <ShieldCheck size={19} />
            Secure signing
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto p-5 md:p-8">

        <div className="mb-7">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Review and Sign Document
          </h1>

          <p className="text-slate-500 mt-2">
            Please review the document and provide your electronic signature.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-7">

          {/* PDF Preview */}
          <section className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden">

            <div className="p-5 border-b border-slate-200 flex items-center gap-3">

              <FileText className="text-blue-600" size={22} />

              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900">
                  Document Preview
                </h2>

                <p className="text-xs text-slate-500 truncate">
                  {documentName || 'Loading document...'}
                </p>
              </div>

            </div>

            {loadingDocument ? (

              <div className="min-h-[450px] flex flex-col items-center justify-center p-8">
                <Loader2
                  className="animate-spin text-blue-600 mb-4"
                  size={38}
                />

                <p className="text-slate-500">
                  Loading your signing document...
                </p>
              </div>

            ) : documentUrl ? (

              <div className="p-4">
                <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-sm text-blue-800">
                    Please sign in the areas marked by the administrator.
                    Your allocated signature and date fields are shown below.
                  </p>
                </div>

                <PdfFieldEditor
                  file={documentUrl}
                  fields={fields}
                  editable={false}
                  signatureImage={signatureImage}
                  signedDate={signedDate}
                />

                {fields.length === 0 && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
                    No signature or date fields were assigned to this document.
                  </p>
                )}
              </div>

            ) : (

              <div className="min-h-[450px] flex flex-col items-center justify-center p-8 text-center">

                <div className="bg-blue-50 text-blue-600 p-5 rounded-2xl mb-5">
                  <FileText size={42} />
                </div>

                <h3 className="font-semibold text-slate-800">
                  Document preview unavailable
                </h3>

                <p className="text-sm text-slate-500 mt-2 max-w-sm">
                  {error || 'The document could not be loaded.'}
                </p>

              </div>
            )}

          </section>

          {/* Signature Section */}
          <section className="lg:col-span-2 space-y-5">

            <div className="bg-white border border-slate-200 rounded-2xl p-6">

              <h2 className="text-lg font-bold text-slate-900">
                Your Signature
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Choose how you want to sign this document.
              </p>

              {/* Signer Full Name */}
              <div className="mt-5">

                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Signer Full Name
                </label>

                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setSignerName(name);

                    setSignatureImage(
                      name.trim() ? createTypedSignature(name.trim()) : ''
                    );
                  }}
                  placeholder="Enter your full legal name"
                  maxLength={120}
                  autoComplete="name"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
                />

                <p className="text-xs text-slate-400 mt-2">
                  Enter the name of the person signing this document.
                </p>

              </div>

              {/* Signature Modes */}
              <div className="grid grid-cols-2 gap-3 mt-6">

                <button
                  type="button"
                  onClick={() => {
                    setMode('draw');
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold ${mode === 'draw'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600'
                    }`}
                >
                  <PenLine size={17} />
                  Draw
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('type');
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold ${mode === 'type'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600'
                    }`}
                >
                  <Type size={17} />
                  Type
                </button>

              </div>

              {/* Draw Signature */}
              {mode === 'draw' ? (

                <div className="mt-5">

                  <p className="text-sm font-medium text-slate-700 mb-3">
                    Draw your signature below
                  </p>

                  <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">

                    <SignatureCanvas
                      ref={signatureRef}
                      penColor="#172554"
                      onEnd={() => {
                        if (signatureRef.current && !signatureRef.current.isEmpty()) {
                          setSignatureImage(
                            signatureRef.current.toDataURL('image/png')
                          );
                        }
                      }}
                      canvasProps={{
                        width: 500,
                        height: 190,
                        className: 'w-full h-[190px] touch-none'
                      }}
                    />

                  </div>

                  <button
                    type="button"
                    onClick={clearSignature}
                    className="mt-3 flex items-center gap-2 text-sm text-red-600"
                  >
                    <Trash2 size={16} />
                    Clear signature
                  </button>

                </div>

              ) : (

                /* Typed Signature */
                <div className="mt-5">

                  <p className="text-sm font-medium text-slate-700 mb-3">
                    Your typed signature
                  </p>

                  <div className="mt-2 bg-slate-50 border rounded-xl p-5 text-center min-h-[110px] flex items-center justify-center">

                    {signerName.trim() ? (

                      <p className="text-3xl italic font-serif text-slate-900 break-words">
                        {signerName}
                      </p>

                    ) : (

                      <p className="text-sm text-slate-400">
                        Your signature will appear here.
                      </p>

                    )}

                  </div>

                </div>
              )}

            </div>

            {/* Consent */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">

              <h3 className="font-semibold text-slate-900 mb-4">
                Signing Consent
              </h3>

              <label className="flex items-start gap-3 cursor-pointer">

                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-blue-600"
                />

                <span className="text-sm text-slate-600 leading-6">
                  I have reviewed this document and agree to use my
                  electronic signature to indicate my acceptance.
                </span>

              </label>

              <div className="mt-5 bg-blue-50 p-4 rounded-xl flex gap-3">

                <ShieldCheck
                  className="text-blue-600 shrink-0"
                  size={21}
                />

                <p className="text-xs text-blue-800 leading-5">
                  Your signing activity and submission details will be
                  recorded by SecureSign.
                </p>

              </div>

            </div>

            {/* Error */}
            {error && (

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700 text-sm">

                <AlertCircle size={19} className="shrink-0" />

                <span>{error}</span>

              </div>
            )}

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || loadingDocument || !documentUrl}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-4 rounded-xl transition"
            >
              {submitting ? 'Submitting...' : 'Submit Signature'}
            </button>

            <p className="text-xs text-center text-slate-400">
              Do not close this page until your signing process is complete.
            </p>

          </section>

        </div>
      </main>
    </div>
  );
}
