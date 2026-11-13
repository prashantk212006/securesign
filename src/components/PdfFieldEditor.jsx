
import { useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Rnd } from 'react-rnd';

import {
    FileSignature,
    CalendarDays,
    Move,
    Maximize2,
    Trash2,
    Info,
} from 'lucide-react';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

export default function PdfFieldEditor({
    file,
    fields = [],
    onFieldsChange,
    editable = true,
}) {
    const [numPages, setNumPages] = useState(0);
    const [pageSizes, setPageSizes] = useState({});
    const [activePage, setActivePage] = useState(1);

    const scrollContainerRef = useRef(null);
    const pageRefs = useRef({});

    const pageWidth = 650;

    // Detect which PDF page is currently in view.
    const handleDocumentScroll = () => {
        const container = scrollContainerRef.current;

        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const referenceY =
            containerRect.top + container.clientHeight / 2;

        let closestPage = 1;
        let smallestDistance = Infinity;

        Object.entries(pageRefs.current).forEach(
            ([pageNumber, element]) => {
                if (!element) return;

                const rect = element.getBoundingClientRect();
                const pageCenter = rect.top + rect.height / 2;
                const distance = Math.abs(referenceY - pageCenter);

                if (distance < smallestDistance) {
                    smallestDistance = distance;
                    closestPage = Number(pageNumber);
                }
            }
        );

        setActivePage(closestPage);
    };

    // Add a field to a particular PDF page.
    const addField = (
        type,
        pageNumber = activePage,
        x = 0.1,
        y = 0.1
    ) => {
        const newField = {
            id: `${type}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 7)}`,
            type,
            page: pageNumber,
            x,
            y,
            width: type === 'signature' ? 0.3 : 0.2,
            height: 0.07,
        };

        onFieldsChange?.([...fields, newField]);
    };

    // Handle dropping a Signature or Date field onto a PDF page.
    const handleFieldDrop = (event, pageNumber) => {
        event.preventDefault();

        if (!editable) return;

        const type =
            event.dataTransfer.getData('fieldType') ||
            event.dataTransfer.getData('text/plain');

        if (!['signature', 'date'].includes(type)) return;

        const pageElement = event.currentTarget;
        const rect = pageElement.getBoundingClientRect();

        if (!rect.width || !rect.height) return;

        const fieldWidth = type === 'signature' ? 0.3 : 0.2;
        const fieldHeight = 0.07;

        const x = Math.max(
            0,
            Math.min(
                (event.clientX - rect.left) / rect.width,
                1 - fieldWidth
            )
        );

        const y = Math.max(
            0,
            Math.min(
                (event.clientY - rect.top) / rect.height,
                1 - fieldHeight
            )
        );

        addField(type, pageNumber, x, y);
    };

    // Allow dragging over PDF pages.
    const handleDragOver = (event) => {
        if (!editable) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };

    // Update field position or size.
    const updateField = (id, changes) => {
        onFieldsChange?.(
            fields.map((field) =>
                field.id === id
                    ? { ...field, ...changes }
                    : field
            )
        );
    };

    // Remove a placed field.
    const removeField = (id) => {
        onFieldsChange?.(
            fields.filter((field) => field.id !== id)
        );
    };

    // Calculate the height of each PDF page.
    const handlePageLoad = (page) => {
        const viewport = page.getViewport({ scale: 1 });
        const height =
            (viewport.height / viewport.width) * pageWidth;

        setPageSizes((previous) => ({
            ...previous,
            [page.pageNumber]: height,
        }));
    };

    // Handle PDF loading.
    const handlePdfLoad = ({ numPages }) => {
        setNumPages(numPages);
        setActivePage(1);
        setPageSizes({});
        pageRefs.current = {};
    };

    // Configure the Signature and Date drag buttons.
    const handleToolDragStart = (event, type) => {
        event.dataTransfer.setData('fieldType', type);
        event.dataTransfer.setData('text/plain', type);
        event.dataTransfer.effectAllowed = 'copy';
    };

    if (!file) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                Upload a PDF to start placing fields.
            </div>
        );
    }

    const signatureCount = fields.filter(
        (field) => field.type === 'signature'
    ).length;

    const dateCount = fields.filter(
        (field) => field.type === 'date'
    ).length;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_250px] gap-5 items-start">

            {/* LEFT: PDF DOCUMENT */}
            <section className="min-w-0">
                <div className="bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden">

                    <div className="bg-white border-b border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="font-bold text-slate-800">
                                Document Preview
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                                Drag a field from the right panel and drop it anywhere on a PDF page.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg font-medium">
                                Page {activePage} of {numPages || 0}
                            </span>
                        </div>
                    </div>

                    <div
                        ref={scrollContainerRef}
                        onScroll={handleDocumentScroll}
                        className="h-[75vh] overflow-y-auto overflow-x-auto p-4 md:p-6"
                    >
                        <Document
                            file={file}
                            onLoadSuccess={handlePdfLoad}
                            loading={
                                <p className="text-center p-10 text-slate-500">
                                    Loading PDF...
                                </p>
                            }
                            error={
                                <p className="text-center p-10 text-red-500">
                                    Unable to load this PDF.
                                </p>
                            }
                        >
                            {Array.from(
                                { length: numPages },
                                (_, index) => {
                                    const pageNumber = index + 1;
                                    const pageHeight =
                                        pageSizes[pageNumber];

                                    return (
                                        <div
                                            key={pageNumber}
                                            ref={(element) => {
                                                pageRefs.current[pageNumber] =
                                                    element;
                                            }}
                                            onDragOver={handleDragOver}
                                            onDrop={(event) =>
                                                handleFieldDrop(
                                                    event,
                                                    pageNumber
                                                )
                                            }
                                            className="relative mx-auto mb-6 border border-slate-300 bg-white shadow-md"
                                            style={{
                                                width: pageWidth,
                                                height: pageHeight || 'auto',
                                            }}
                                        >
                                            <Page
                                                pageNumber={pageNumber}
                                                width={pageWidth}
                                                onLoadSuccess={handlePageLoad}
                                                renderTextLayer
                                                renderAnnotationLayer
                                            />

                                            {/* FIELDS BELONGING TO THIS PAGE */}
                                            {pageHeight && (
                                                <div className="absolute inset-0 pointer-events-none">
                                                    {fields
                                                        .filter(
                                                            (field) =>
                                                                field.page ===
                                                                pageNumber
                                                        )
                                                        .map((field) => (
                                                            <Rnd
                                                                key={field.id}
                                                                bounds="parent"
                                                                disableDragging={
                                                                    !editable
                                                                }
                                                                enableResizing={
                                                                    editable
                                                                }
                                                                dragHandleClassName="field-drag-handle"
                                                                cancel=".field-remove-button"
                                                                position={{
                                                                    x:
                                                                        field.x *
                                                                        pageWidth,
                                                                    y:
                                                                        field.y *
                                                                        pageHeight,
                                                                }}
                                                                size={{
                                                                    width:
                                                                        field.width *
                                                                        pageWidth,
                                                                    height:
                                                                        field.height *
                                                                        pageHeight,
                                                                }}
                                                                onDragStop={(
                                                                    event,
                                                                    data
                                                                ) => {
                                                                    updateField(
                                                                        field.id,
                                                                        {
                                                                            x:
                                                                                data.x /
                                                                                pageWidth,
                                                                            y:
                                                                                data.y /
                                                                                pageHeight,
                                                                        }
                                                                    );
                                                                }}
                                                                onResizeStop={(
                                                                    event,
                                                                    direction,
                                                                    ref,
                                                                    delta,
                                                                    position
                                                                ) => {
                                                                    updateField(
                                                                        field.id,
                                                                        {
                                                                            x:
                                                                                position.x /
                                                                                pageWidth,
                                                                            y:
                                                                                position.y /
                                                                                pageHeight,
                                                                            width:
                                                                                ref.offsetWidth /
                                                                                pageWidth,
                                                                            height:
                                                                                ref.offsetHeight /
                                                                                pageHeight,
                                                                        }
                                                                    );
                                                                }}
                                                                style={{
                                                                    pointerEvents:
                                                                        'auto',
                                                                }}
                                                                className="z-10"
                                                            >
                                                                <div
                                                                    className={`field-drag-handle relative flex h-full w-full cursor-move select-none items-center justify-center gap-1 rounded border-2 border-dashed px-2 pr-7 text-xs font-semibold ${
                                                                        field.type ===
                                                                        'signature'
                                                                            ? 'border-blue-500 bg-blue-100/90 text-blue-800'
                                                                            : 'border-green-500 bg-green-100/90 text-green-800'
                                                                    }`}
                                                                >
                                                                    {field.type ===
                                                                    'signature' ? (
                                                                        <FileSignature
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <CalendarDays
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    )}

                                                                    {field.type ===
                                                                    'signature'
                                                                        ? 'Signature'
                                                                        : 'Date'}

                                                                    {editable && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(
                                                                                event
                                                                            ) => {
                                                                                event.stopPropagation();
                                                                                removeField(
                                                                                    field.id
                                                                                );
                                                                            }}
                                                                            onTouchStart={(
                                                                                event
                                                                            ) =>
                                                                                event.stopPropagation()
                                                                            }
                                                                            className="field-remove-button absolute -right-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-red-600 text-lg font-bold leading-none text-white shadow-md transition hover:scale-110 hover:bg-red-700"
                                                                            title="Remove field"
                                                                            aria-label="Remove field"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </Rnd>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                            )}
                        </Document>
                    </div>
                </div>
            </section>

            {/* RIGHT: FIELD TOOLS */}
            <aside className="lg:sticky lg:top-4 self-start">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">

                    <div>
                        <h3 className="text-lg font-bold text-slate-900">
                            Field Tools
                        </h3>

                        <p className="text-xs text-slate-500 mt-1">
                            Drag a field onto your document.
                        </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <p className="text-xs text-blue-700 font-semibold">
                            Currently selected page
                        </p>

                        <p className="text-2xl font-bold text-blue-800 mt-1">
                            Page {activePage}
                        </p>

                        <p className="text-xs text-blue-600 mt-1">
                            You can drop fields onto any visible PDF page.
                        </p>
                    </div>

                    {editable && (
                        <div className="space-y-3">

                            {/* SIGNATURE TOOL */}
                            <button
                                type="button"
                                draggable={true}
                                onDragStart={(event) =>
                                    handleToolDragStart(
                                        event,
                                        'signature'
                                    )
                                }
                                onClick={() => addField('signature')}
                                className="w-full flex items-center gap-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white p-3 font-semibold text-sm transition cursor-grab active:cursor-grabbing"
                            >
                                <FileSignature size={19} />
                                Add Signature
                            </button>

                            {/* DATE TOOL */}
                            <button
                                type="button"
                                draggable={true}
                                onDragStart={(event) =>
                                    handleToolDragStart(event, 'date')
                                }
                                onClick={() => addField('date')}
                                className="w-full flex items-center gap-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white p-3 font-semibold text-sm transition cursor-grab active:cursor-grabbing"
                            >
                                <CalendarDays size={19} />
                                Add Date
                            </button>
                        </div>
                    )}

                    {/* PLACED FIELD COUNTS */}
                    <div className="border-t border-slate-200 pt-4">
                        <h4 className="text-xs font-bold text-slate-500 mb-4">
                            PLACED FIELDS
                        </h4>

                        <div className="flex items-center justify-between mb-4">
                            <span className="flex items-center gap-2 text-sm text-slate-600">
                                <FileSignature
                                    size={16}
                                    className="text-blue-600"
                                />
                                Signatures
                            </span>

                            <span className="font-bold text-blue-600">
                                {signatureCount}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-sm text-slate-600">
                                <CalendarDays
                                    size={16}
                                    className="text-green-600"
                                />
                                Dates
                            </span>

                            <span className="font-bold text-green-600">
                                {dateCount}
                            </span>
                        </div>
                    </div>

                    {/* FIELD INSTRUCTIONS */}
                    <div className="border-t border-slate-200 pt-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-500">
                            FIELD INSTRUCTIONS
                        </h4>

                        <div className="flex items-start gap-2 text-xs text-slate-600">
                            <Move
                                size={15}
                                className="shrink-0 text-blue-600"
                            />
                            Drag Signature or Date onto the PDF to place it.
                        </div>

                        <div className="flex items-start gap-2 text-xs text-slate-600">
                            <Move
                                size={15}
                                className="shrink-0 text-blue-600"
                            />
                            Drag a placed field to move it.
                        </div>

                        <div className="flex items-start gap-2 text-xs text-slate-600">
                            <Maximize2
                                size={15}
                                className="shrink-0 text-blue-600"
                            />
                            Drag its edges to resize it.
                        </div>

                        <div className="flex items-start gap-2 text-xs text-slate-600">
                            <Trash2
                                size={15}
                                className="shrink-0 text-red-500"
                            />
                            Use × to remove a field.
                        </div>
                    </div>

                    {/* INFORMATION */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <div className="flex items-start gap-2 text-blue-700">
                            <Info
                                size={16}
                                className="shrink-0 mt-0.5"
                            />

                            <p className="text-xs leading-relaxed">
                                Drag a field from the right panel and drop
                                it at the required position on any PDF
                                page. You can still click the buttons to
                                add fields to the currently selected page.
                            </p>
                        </div>
                    </div>

                </div>
            </aside>
        </div>
    );
}
